import _ from "lodash"
import { type HasType } from "./types"
import { createNodeBuilder } from "./createBuilder"
import { stringifyNestedObjects } from "./stringifyNestedObjects"
import { type NodeEntry } from "graphology-types"
import { DataCollection } from "./DataCollection"
import { state } from "./globals"

export function nodeDataPipeline<TData extends NodeEntry<HasType>[]>(
	entries: TData
) {
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
