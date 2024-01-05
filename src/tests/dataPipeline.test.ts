import { describe, expect, it } from "vitest"

import { edgeDataPipeline } from "../edgeDataPipeline"
import { nodeDataPipeline } from ".."
import { createTestRelationGraphData } from "./testUtils/relationsGraph"
import _ from "lodash"

import { type GraphTestData } from "./testUtils/generatedTypes"

describe("dataPipeline", () => {
	const { graph } = createTestRelationGraphData()

	describe("edges", () => {
		const edgeCollection = edgeDataPipeline([...graph.edgeEntries()])
		const data = edgeCollection.data as unknown as GraphTestData
		it("should produce 3 edge builders", () => {
			// graph data has 3 different types of relationships, table -> table, table -> view, view -> table
			const res = Object.values(edgeCollection.getBuilders())
			expect(res.length).toBe(3)
		})

		it("total bind param item count (edge data) should equal the graph's edge count", () => {
			const params = _.chain(edgeCollection.getBuilders())
				.map((s) => {
					const res = s.getBindParam().get() as Record<string, any[]>
					return _.values(res)
				})
				.flattenDeep()
				.filter((s) => typeof s.attributes?.type === "string")
				.value()

			expect(params.length).toBe(graph.size)
		})

		describe("should produce valid cypher statements", () => {
			const expected = {
				viewRelations_table_out_view:
					"WITH $viewRelations_table_out_view AS v UNWIND v AS x MATCH (a:table) WHERE a.id = x.source MATCH (b:view) WHERE b.id = x.target CREATE (a)-[r:viewRelations]->(b) SET r = x.attributes",
				viewRelations_view_out_view:
					"WITH $viewRelations_view_out_view AS v UNWIND v AS x MATCH (a:view) WHERE a.id = x.source MATCH (b:view) WHERE b.id = x.target CREATE (a)-[r:viewRelations]->(b) SET r = x.attributes",
				tableRelations_table_out_table:
					"WITH $tableRelations_table_out_table AS v UNWIND v AS x MATCH (a:table) WHERE a.id = x.source MATCH (b:table) WHERE b.id = x.target CREATE (a)-[r:tableRelations]->(b) SET r = x.attributes",
			}
			_.each(expected, (v, k) => {
				const description = {
					key: k,
					statement: v,
				}
				it(JSON.stringify(description), () => {
					expect(edgeCollection.getStatements()[k]).toBe(v)
				})
			})
		})

		it("should produce valid schema data", () => {
			const tableToView = data.viewRelations_table_out_view.schema
			expect(tableToView.sourceType).toBe("table")
			expect(tableToView.targetType).toBe("view")

			const viewToView = data.viewRelations_view_out_view.schema
			expect(viewToView.sourceType).toBe("view")
			expect(viewToView.targetType).toBe("view")
		})
	})

	describe("nodes", () => {
		const nodeCollection = nodeDataPipeline([...graph.nodeEntries()])

		it("should produce 2 node builders", () => {
			const res = Object.values(nodeCollection.getBuilders())
			expect(res.length).toBe(2)
		})

		it("total bind param item count (node data) should equal the graph's node count", () => {
			const params = _.chain(nodeCollection.getBuilders())
				.map((s) => {
					const res = s.getBindParam().get() as Record<string, any[]>
					return _.values(res)
				})
				.flattenDeep()
				.filter((s) => typeof s.type === "string")
				.value()
			expect(params.length).toBe(graph.order)
		})

		describe("should produce valid cypher statements", () => {
			const expected = {
				table: "WITH $table AS v UNWIND v AS x CREATE (n:table { id: $id }) SET n += x",
				view: "WITH $view AS v UNWIND v AS x CREATE (n:view { id: $id }) SET n += x",
			}
			_.each(expected, (v, k) => {
				const description = {
					key: k,
					statement: v,
				}
				it(JSON.stringify(description), () => {
					expect(nodeCollection.getStatements()[k]).toBe(v)
				})
			})
		})

		it("should produce valid schema data", () => {
			const tableProps = ["type", "label", "columns"]
			const viewProps = ["type", "label", "columns"]
			const table = nodeCollection.getSchemas().table
			const view = nodeCollection.getSchemas().view
			expect(table).toEqual(expect.arrayContaining(tableProps))
			expect(view).toEqual(expect.arrayContaining(viewProps))
		})
	})
})
