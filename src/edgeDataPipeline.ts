import _ from "lodash"
import { type HasType } from "./types"
import { createEdgeBuilder } from "./createBuilder"
import { orderResolver } from "./orderResolver"
import { type EdgeSchemaData } from "./types"
import { stringifyNestedObjects } from "./stringifyNestedObjects"
import { type EdgeEntry } from "graphology-types"
import { state } from "./globals"
import { DataCollection } from "./DataCollection"
import { z } from "zod"

export function edgeDataPipeline<TData extends EdgeEntry<HasType, HasType>[]>(
	entries: TData
) {
	return _.chain(entries)
		.map(({ undirected, ...props }) => {
			// reduce batch unwind batch operations needed by making all edges uniform in direction

			if (undirected === true) {
				return {
					...props,
					...orderResolver(
						props.source,
						props.sourceAttributes,
						props.target,
						props.targetAttributes
					),
					direction: "none" as const,
				}
			}
			return { ...props, direction: "out" as const }
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
			// flatten and remove extraneous node attributes

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
