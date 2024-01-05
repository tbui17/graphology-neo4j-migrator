import { toGenericStruct } from "@neo4j/introspector"
import _ from "lodash"
import { type SourceFile, Project, CodeBlockWriter } from "ts-morph"
import { z } from "zod"
import { postDFSObjectTraversal } from "@tbui17/iteration-utilities"

import { zodGuard } from "@tbui17/utils"
import { pickToArray } from "@tbui17//iteration-utilities"
import { type TypeProperty } from "./types"
import { type IntrospectorConfigs } from "./types"
import { type Neo4jStruct } from "./types"
import { type Driver } from "neo4j-driver"

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

const propertySchema = z.object({
	name: z.string(),
	mandatory: z.boolean(),
	types: z.array(z.string()),
})

const baseTypes = new Set(["string", "number", "boolean", "date"])

export class Neo4jIntrospector {
	constructor(public driver: Driver) {}

	async fetch() {
		return toGenericStruct(() => this.driver.session())
	}
}

export class Neo4jTypeGen {
	private project: Project
	private file: SourceFile
	private fields

	constructor(
		public configs: Required<IntrospectorConfigs>,
		private introspector = new Neo4jIntrospector(configs.driver)
	) {
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
		const data = await this.introspector.fetch()
		this.generateType(data)
		this.save()
	}

	private save() {
		this.file.saveSync()
	}

	generateType(data: Neo4jStruct) {
		data.nodes = _.mapKeys(data.nodes, (_v, k) => {
			return k.slice(2, -1)
		})

		postDFSObjectTraversal(data, (ctx) => {
			if (!ctx.isRecord() || !zodGuard(propertySchema, ctx.context)) {
				return
			}
			ctx.context.types = ctx.context.types.map((s) => {
				s = s.toLowerCase()
				if (baseTypes.has(s)) {
					return s
				}
				if (s === "list") {
					return "unknown[]"
				}
				return "unknown"
			})
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
		return this.file.print()
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
