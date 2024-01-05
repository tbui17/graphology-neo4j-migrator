import { toGenericStruct } from "@neo4j/introspector"
import _ from "lodash"
import { type SourceFile, Project, CodeBlockWriter } from "ts-morph"
import { z } from "zod"
import { postDFSObjectTraversal } from "@tbui17/iteration-utilities"

import { zodGuard } from "@tbui17/utils"
import { type Driver } from "neo4j-driver"
import { type ConditionalExcept } from "type-fest"
import { cypherToGraph } from "graphology-neo4j"
import type Graph from "graphology"
import { pickToArray } from "@tbui17//iteration-utilities"

function createObjectTypeEntry({
	name,
	types,
	mandatory,
}: {
	name: string
	types: string[] | string
	mandatory: boolean
}) {
	const type = Array.isArray(types) ? types.join(" | ") : types

	return `${name}${mandatory ? "" : "?"}: ${type}`
}

function formatTypeName(typeName: string): string {
	// _.chain(typeName).camelCase().upperFirst().value()
	return typeName
}

type Neo4jStruct = Awaited<ReturnType<typeof toGenericStruct>>

const propertySchema = z.object({
	name: z.string(),
	mandatory: z.boolean(),
	types: z.array(z.string()),
})

const baseTypes = new Set(["string", "number", "boolean", "date"])

type Configs = {
	driver: Driver
	typeFileDirectory: string
	idFieldName?: string
	typeFieldName?: string
	labelFieldName?: string
	typeFieldDelimiter?: string
	graphName?: string
	graphNodeName?: string
	graphEdgeName?: string
}
type OptionalKeysHelper<T> = {
	[K in keyof T]-?: T extends Record<K, T[K]> ? never : T[K]
}
type OptionalKeys<T> = ConditionalExcept<OptionalKeysHelper<T>, never>

async function generateGraph(configs: Required<Configs>) {
	const query = `MATCH (n)-[r]-(m)
RETURN n, r, m

UNION

MATCH (n)
WHERE NOT (n)--()
RETURN n, NULL as r, NULL as m
`
	const graph = await cypherToGraph(
		{
			driver: configs.driver,
		},
		query,
		undefined,
		{
			id: configs.idFieldName,
			labels: configs.labelFieldName,
			type: configs.typeFieldName,
		}
	)

	graph.updateEachNodeAttributes((_node, attr) => {
		const labelValue = attr[configs.labelFieldName]
		if (Array.isArray(labelValue)) {
			attr[configs.typeFieldName] = labelValue.join(
				configs.typeFieldDelimiter
			)
		}
		return attr
	})
	return graph
}

const baseConfigs: OptionalKeys<Configs> = {
	idFieldName: "_id",
	typeFieldName: "_type",
	labelFieldName: "_labels",
	typeFieldDelimiter: "_",
	graphName: "Graph2",
	graphNodeName: "GraphNode",
	graphEdgeName: "GraphEdge",
}

export class GraphologyNeo4jGenerator {
	private configs
	private introspector

	constructor(configs: Configs) {
		this.configs = {
			...baseConfigs,
			...configs,
		}
		this.introspector = new Neo4jIntrospector(this.configs)
	}

	async generateGraphTypes() {
		await this.introspector.run()
	}

	async generateGraph<TGraph extends Graph = Graph>() {
		const graph = await generateGraph(this.configs)
		return graph as TGraph
	}

	async closeDriver() {
		await this.configs.driver.close()
	}
}

class Neo4jIntrospector {
	private project: Project
	private file: SourceFile
	private fields

	constructor(public configs: Required<Configs>) {
		this.project = new Project()
		this.file = this.project.createSourceFile(
			this.configs.typeFileDirectory,
			"",
			{
				overwrite: true,
			}
		)
		this.fields = pickToArray(this.configs, [
			"idFieldName",
			"labelFieldName",
			"typeFieldName",
		])
	}

	async run() {
		const data = await toGenericStruct(() => this.configs.driver.session())

		data.nodes = _.mapKeys(data.nodes, (_v, k) => {
			return k.slice(2, -1)
		})
		zodGuard(propertySchema,{})

		postDFSObjectTraversal(data, (ctx) => {
			if (!ctx.isRecord() || !zodGuard(propertySchema, ctx.context)) {
				return
			}
			ctx.merge({
				types: ctx.context.types.map((s) => {
					s = s.toLowerCase()
					if (baseTypes.has(s)) {
						return s
					}
					if (s === "list") {
						return "unknown[]"
					}
					return "unknown"
				}),
			})

			// ctx.context.types = ctx.context.types.map((s) => {
			// 	s = s.toLowerCase()
			// 	if (baseTypes.has(s)) {
			// 		return s
			// 	}
			// 	if (s === "list") {
			// 		return "unknown[]"
			// 	}
			// 	return "unknown"
			// })
		})

		this.file.addImportDeclaration({
			moduleSpecifier: "Graphology",
			defaultImport: "Graph",
			isTypeOnly: true,
		})

		const keys = _.mapValues(data, (v) => {
			return new Set(Object.keys(v))
		})

		this.writeNodes(data.nodes)
		this.writeRelations(data.relationships)
		this.writeAggregateUnionType(keys.nodes, "Node")
		this.writeAggregateUnionType(keys.relationships, "Edge")
		this.createGraphType()

		await this.file.save()
	}

	private writeAggregateUnionType(
		cache: Set<string> | string[],
		type: "Node" | "Edge"
	) {
		const typeStr = Array.from(cache)
			.map((s) => formatTypeName(s))
			.join(" | ")

		const graphName =
			type === "Edge"
				? this.configs.graphEdgeName
				: this.configs.graphNodeName

		this.file.addTypeAlias({
			name: graphName,
			isExported: true,
			type: typeStr,
		})
	}

	private writeNodes(nodeStruct: Neo4jStruct["nodes"]) {
		_.chain(nodeStruct)
			.each((v, typeName) => {
				const typeProperties = v.properties
					.filter((s) => !this.fields.includes(s.name))
					.concat({
						name: this.configs.idFieldName,
						mandatory: true,
						types: ["string"],
					})

					.concat({
						name: this.configs.labelFieldName,
						mandatory: true,
						types: [JSON.stringify(v.labels)],
					})
					.concat({
						name: this.configs.typeFieldName,
						mandatory: true,
						types: [
							`"${v.labels.join(
								this.configs.typeFieldDelimiter
							)}"`,
						],
					})

				this.writeType(typeName, typeProperties)
			})
			.value()
	}

	private writeType(typeName: string, typeProperties: TypeProperty[]) {
		this.file.addTypeAlias({
			name: formatTypeName(typeName),
			isExported: true,
			type: this.createObjectType(typeProperties),
		})
	}

	private createObjectType(typeProperties: TypeProperty[]) {
		const w = new CodeBlockWriter()

		return w
			.block(() => {
				typeProperties
					.map((prop) => {
						return createObjectTypeEntry({
							name: prop.name,
							types: prop.types,
							mandatory: prop.mandatory,
						})
					})
					.forEach((str) => {
						w.writeLine(str)
					})
			})
			.toString()
	}

	private writeRelations(relationsStruct: Neo4jStruct["relationships"]) {
		Object.entries(relationsStruct).forEach(([typeName, v]) => {
			const typeProperties = v.properties
				.filter((s) => !this.fields.includes(s.name))
				.concat({
					name: this.configs.idFieldName,
					mandatory: true,
					types: ["string"],
				})
				.concat({
					name: this.configs.typeFieldName,
					mandatory: true,
					types: [`"${typeName}"`],
				})

			this.writeType(typeName, typeProperties)
		})
	}

	private createGraphType() {
		this.file.addTypeAlias({
			name: this.configs.graphName,
			isExported: true,
			type: `Graph<${this.configs.graphNodeName},${this.configs.graphEdgeName}>`,
		})
	}
}

type TypeProperty = {
	name: string
	types: string[]
	mandatory: boolean
}
