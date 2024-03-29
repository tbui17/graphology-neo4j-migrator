import { Neogma } from "neogma"
import {
	type QueryResult,
	type RecordShape,
	type Transaction,
} from "neo4j-driver"

import {
	type HasType,
	type GraphWithType,
	type WhiteListSettings,
} from "./types"
import { type GraphToCipherMigratorConstructor } from "./types"
import EventEmitter from "events"
import { nodeDataPipeline } from "./nodeDataPipeline"
import { edgeDataPipeline } from "./edgeDataPipeline"
import {
	EdgeResultSubmitter,
	NodeResultSubmitter,
	type ResultSubmitter,
} from "./resultSubmitter"
import { type Attributes } from "graphology-types"
import mapValues from "lodash/mapValues"
import { collectionFromObject } from "@tbui17/utils"
import { MigrationError, WhiteListError } from "."
import { type LiteralUnion } from "type-fest"
import { type Collection } from "@discordjs/collection"

export function retrieveGraphData<
	TNode extends HasType,
	TEdge extends HasType,
	TAttributes extends Attributes,
>(graph: GraphWithType<TNode, TEdge, TAttributes>) {
	const nodes = nodeDataPipeline([...graph.nodeEntries()])
	const edges = edgeDataPipeline([...graph.edgeEntries()])
	const indexStatements = nodes
		.getTypes()
		.map((type) => createUniqueIndexForNodeType(type))

	return {
		nodes,
		edges,
		indexStatements,
	}
}

export function createUniqueIndexForNodeType(type: string) {
	const node = `n${type}`
	const constraintName = `unique_id_${type}`
	return `CREATE CONSTRAINT ${constraintName} IF NOT EXISTS FOR (${node}:${type}) REQUIRE ${node}.id IS UNIQUE`
}

export const applyTimeLogging = (emitter: EventEmitter) => {
	let startTime: number
	emitter.on("start", () => {
		startTime = Date.now()
	})
	emitter.on("end", () => {
		const endTime = Date.now()
		console.log(`Time taken: ${endTime - startTime}ms`)
	})
}

type EventTypes = LiteralUnion<
	"start" | "indexesCreated" | "nodesCreated" | "edgesCreated" | "end",
	string
>

interface MigratorEventEmitter extends EventEmitter {
	on(event: EventTypes, listener: (...args: any[]) => void): this
}

export interface MigratorReturnType {
	indexTransactionResult: QueryResult<RecordShape>[]
	nodeTransactionResult: Collection<string, QueryResult<RecordShape>>
	edgeTransactionResult: Collection<string, QueryResult<RecordShape>>
}

export class GraphToCypherMigrator<
	TNode extends HasType,
	TEdge extends HasType,
	TAttributes extends Attributes,
> {
	private graph: GraphToCipherMigratorConstructor<
		TNode,
		TEdge,
		TAttributes
	>["graph"]
	private connectionDetails: GraphToCipherMigratorConstructor<
		TNode,
		TEdge,
		TAttributes
	>["connectionDetails"]
	private options: GraphToCipherMigratorConstructor<
		TNode,
		TEdge,
		TAttributes
	>["neo4jOptions"]

	public eventEmitter: MigratorEventEmitter = new EventEmitter()
	public client: Neogma
	private cache: ReturnType<typeof retrieveGraphData> | null = null
	private whiteListSettings: WhiteListSettings | null = null
	constructor({
		connectionDetails,
		graph,
		whiteListSettings,
		neo4jOptions,
	}: GraphToCipherMigratorConstructor<TNode, TEdge, TAttributes>) {
		this.graph = graph
		this.connectionDetails = connectionDetails
		this.options = neo4jOptions
		this.client = new Neogma(this.connectionDetails, this.options)
		this.setWhiteListSettings(whiteListSettings)
	}

	public run(): Promise<MigratorReturnType> {
		if (this.whiteListSettings !== null || (this.whiteListSettings)) {
			this.validate()
		}
		return this.runImpl()
	}

	public setWhiteListSettings(settings: WhiteListSettings | "ignore") {
		if (settings  === "ignore"){
			this.whiteListSettings = null
			return this
		}
		if (typeof settings !== "object"){
			throw new WhiteListError("White list settings must be an object or 'ignore'")
		}
		if (!Array.isArray(settings.whiteList)){
			throw new WhiteListError("White list settings must have a whiteList property which is an array.")
		}
		this.whiteListSettings = settings
		return this
	}

	private validate() {
		const lists = this.getWhiteListData()
		const whiteListSet = new Set(lists.whiteList)
		const invalidTypes = lists.types.filter(
			(type) => !whiteListSet.has(type)
		)

		if (!invalidTypes.length) {
			return
		}
		const message = {
			message:
				"There were invalid node types which were not in the white list detected in the graph.",
			whiteList: lists.whiteList,
			invalidTypes,
		}
		const stringMessage = JSON.stringify(message, null, 2)
		throw new WhiteListError(stringMessage)
	}

	private getWhiteListData() {
		if (!this.whiteListSettings) {
			throw new WhiteListError("White list settings have not been set.")
		}
		const lists = {
			whiteList: this.whiteListSettings.whiteList,
			types: this.retrieveGraphData().nodes.getTypes(),
		}
		if (this.whiteListSettings.caseInsensitive) {
			return mapValues(lists, (s) => s.map((s) => s.toLowerCase()))
		}
		return lists
	}

	private retrieveGraphData() {
		if (this.cache) {
			return this.cache
		}
		const data = retrieveGraphData(this.graph)
		this.cache = data
		return data
	}

	private clearCache() {
		this.cache = null
	}

	private async runImpl(): Promise<MigratorReturnType> {
		this.eventEmitter.emit("start")
		const indexTransactionResult = await this.runCreateIndexesTransaction()
		this.eventEmitter.emit("indexesCreated", indexTransactionResult)
		const nodeTransactionResult = await this.runNodeTransactions()
		this.eventEmitter.emit("nodesCreated", nodeTransactionResult)
		const edgeTransactionResult = await this.runEdgeTransactions()
		this.eventEmitter.emit("edgesCreated", edgeTransactionResult)
		this.eventEmitter.emit("end")
		this.clearCache()

		await this.client.driver.close()
		return {
			indexTransactionResult,
			nodeTransactionResult,
			edgeTransactionResult,
		}
	}

	private async runEdgeTransactions() {
		const { edges } = this.retrieveGraphData()
		const edgeTransaction = await this.client.driver
			.session()
			.beginTransaction()
		const edgeSubmitter = new EdgeResultSubmitter(
			collectionFromObject(edges.getBuilders()),
			edgeTransaction
		)
		const result = await this.submitCypherStatements(edgeSubmitter)
		await edgeTransaction.commit()
		return result.mapValues((s) => s.transactionResult)
	}

	private async runNodeTransactions() {
		const { nodes } = this.retrieveGraphData()
		const nodeTransaction = await this.client.driver
			.session()
			.beginTransaction()
		const nodeSubmitter = new NodeResultSubmitter(
			collectionFromObject(nodes.getBuilders()),
			nodeTransaction
		)
		const result = await this.submitCypherStatements(nodeSubmitter)
		await nodeTransaction.commit()
		return result.mapValues((s) => s.transactionResult)
	}

	private async submitCypherStatements(submitter: ResultSubmitter) {
		try {
			const res = await submitter.run()
			if (res.rejected.size) {
				throw new MigrationError("Error in node creation", {
					cause: res.rejected.toJSON(),
				})
			}
			return res.fulfilled
		} catch (e) {
			await submitter.transaction.rollback()
			await this.client.driver.close()
			throw e
		}
	}
	private async runCreateIndexesTransaction() {
		const indexStatement = this.retrieveGraphData()
			.nodes.getTypes()
			.map((type) => createUniqueIndexForNodeType(type))

		const indexTransaction = await this.client.driver
			.session()
			.beginTransaction()
		const result = await this.createIndexes(
			indexStatement,
			indexTransaction
		)
		await indexTransaction.commit()
		return result
	}

	private async createIndexes(
		indexStatements: string[],
		transaction: Transaction
	) {
		try {
			return await Promise.all(
				indexStatements.map((statement) => this.createIndex(statement))
			)
		} catch (e) {
			await transaction.rollback()
			await this.client.driver.close()
			throw e
		}
	}

	private async createIndex(indexingStatement: string) {
		try {
			return await this.client.queryRunner.run(indexingStatement)
		} catch (e) {
			if (!(e instanceof Error)) {
				throw e
			}
			throw new MigrationError(
				`Failed to create unique index on nodes with statement: ${indexingStatement}`,
				{ cause: e }
			)
		}
	}
}
