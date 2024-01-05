import _ from "lodash"
import { z } from "zod"
import { type HasType } from "./types"

import { createEdgeBuilder, createNodeBuilder } from "./builder"
import { orderResolver } from "./resolver"
import { type EdgeSchemaData } from "./types"
import { stringifyNestedObjects } from "./utils/stringifyNestedObjects"
import { type EdgeEntry, type NodeEntry } from "graphology-types"
import { type QueryBuilder } from "neogma"

const state = {
	didOverrideIdForNode: false,
	didOverrideIdForEdge: false,
}

export function buildNodes<TData extends NodeEntry<HasType>[]>(entries: TData) {
	return _.chain(entries)

		.groupBy((node) => node.attributes.type)
		.mapValues((nodes, type) => {
			const schema = _.chain(nodes)
				.flatMap((node) => _.keys(node.attributes))
				.uniq()
				.value()
			const input = nodes.map((node) => {
				node.attributes = stringifyNestedObjects(node.attributes)
				if ("id" in node.attributes) {
					state.didOverrideIdForNode = true
					node.attributes._id = node.attributes.id
				}
				return {
					...node.attributes,
					id: node.node,
				}
			})
			const builder = createNodeBuilder(
				{
					[type]: input,
				},
				type
			)

			return {
				data: nodes,
				schema,
				builder,
			}
		})
		.thru((s) => new DataCollection(s))
		.value()
}

const edgeBuilderArgsSchema = z.object({
	compositeKey: z.string(),
	direction: z.union([z.literal("none"), z.literal("out")]),
	edgeType: z.string(),
	sourceIdField: z.string(),
	sourceType: z.string(),
	targetIdField: z.string(),
	targetType: z.string(),
	edgeSourceFieldIdAccessor: z.string(),
	edgeTargetFieldIdAccessor: z.string(),
	edgeAttributesFieldAccessor: z.string(),
})

type CreateBuilderArgsWithDefaultsArgs = {
	key: string
	direction: "none" | "out"
	edgeType: string
	sourceType: string
	targetType: string
}

function createBuilderArgsWithDefaults(
	args: CreateBuilderArgsWithDefaultsArgs
): z.infer<typeof edgeBuilderArgsSchema> {
	const { key, direction, edgeType, sourceType, targetType } = args
	const defaults = {
		sourceIdField: "id",
		targetIdField: "id",
		edgeSourceFieldIdAccessor: "source",
		edgeTargetFieldIdAccessor: "target",
		edgeAttributesFieldAccessor: "attributes",
	} as const
	const res = {
		compositeKey: key,
		direction,
		edgeType,
		...defaults,
		sourceType,
		targetType,
	} satisfies z.infer<typeof edgeBuilderArgsSchema>

	return edgeBuilderArgsSchema.parse(res)
}

function createEdgeTypeKey(schemaData: EdgeSchemaData) {
	return `${schemaData.type}_${schemaData.sourceType}_${schemaData.direction}_${schemaData.targetType}` as const
}

function createBuilderArgsFromEdgeSchema(schemaData: EdgeSchemaData) {
	return createBuilderArgsWithDefaults({
		key: createEdgeTypeKey(schemaData),
		direction: schemaData.direction,
		edgeType: schemaData.type,
		sourceType: schemaData.sourceType,
		targetType: schemaData.targetType,
	})
}

export function buildEdges<TData extends EdgeEntry<HasType, HasType>[]>(
	entries: TData
) {
	return _.chain(entries)

		.map(({ undirected, ...props }) => {
			// reduce batch unwind batch operations needed by making all edges uniform in direction
			return undirected === true
				? {
						...props,
						...orderResolver(
							props.source,
							props.sourceAttributes,
							props.target,
							props.targetAttributes
						),
						direction: "none" as const,
				  }
				: { ...props, direction: "out" as const }
		})
		.map((edge) => {
			const schemaData: EdgeSchemaData = {
				type: edge.attributes.type,
				sourceType: edge.sourceAttributes.type,
				targetType: edge.targetAttributes.type,
				direction: edge.direction,
			}
			return {
				edge,
				schemaData,
			}
		})
		.groupBy((edge) => createEdgeTypeKey(edge.schemaData))
		.mapValues((edgeAggregation) => {
			// flatten
			return {
				data: edgeAggregation.map(
					({
						edge: { edge, source, target, direction, attributes },
					}) => ({
						edge,
						source,
						target,
						direction,
						attributes,
					})
				),
				schema: edgeAggregation[0]!.schemaData,
			}
		})
		.mapValues(({ data, schema }, key) => {
			// create edge statements
			const bindParams = data.map((edge) => {
				if ("id" in edge.attributes) {
					state.didOverrideIdForEdge = true
					edge.attributes._id = edge.attributes.id
				}
				edge.attributes.id = edge.edge
				return {
					...edge,
					attributes: stringifyNestedObjects(edge.attributes),
				}
			})
			const builder = createEdgeBuilder(
				{
					[key]: bindParams,
				},
				createBuilderArgsFromEdgeSchema(schema)
			)
			// one builder per edge type for ease of partitioning per batch later on

			return {
				data,
				schema,
				builder,
			}
		})
		.thru((s) => new DataCollection(s))
		.value()
}

/**
 * Holds data for a batch of nodes or edges grouped by type.
 */
type DataCollectionRecord<TData, TSchema> = Record<
	string,
	{
		data: TData[]
		schema: TSchema
		builder: QueryBuilder
	}
>
class DataCollection<TData, TSchema> {
	constructor(public data: DataCollectionRecord<TData, TSchema>) {}

	public getTypes() {
		return Object.keys(this.data)
	}

	public getStatements() {
		return _.mapValues(this.data, (s) => s.builder.getStatement())
	}

	public getStatementsForType(type: string) {
		return this.data[type]?.builder.getStatement()
	}

	public getSchemas() {
		return _.mapValues(this.data, (s) => s.schema)
	}

	public getSchemaForType(type: string) {
		return this.data[type]?.schema
	}

	public getBuilders() {
		return _.mapValues(this.data, (s) => s.builder)
	}
}
