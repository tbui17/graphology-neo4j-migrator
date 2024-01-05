import Graph from "graphology"
import _ from "lodash"
import { faker } from "@faker-js/faker"

type TableColumnsView = {
	table_name: string
	column_name: string
	data_type: string
}
type ViewDependencies = {
	dependent_view: string
	source_tables: Record<string, string[]>
}
type Relations = {
	constraint_name: string
	table_name: string
	column_name: string
	foreign_table_name: string
	foreign_column_name: string
}
interface BaseNode<TType extends string = string> {
	type: TType
	label: string
}

interface TableColumnsViewNode extends BaseNode {
	type: "table" | "view"
	columns: {
		column_name: string
		data_type: string
	}[]
}

interface TableRelationsEdge extends BaseNode {
	type: "tableRelations"
	table_name: string
	column_name: string
	constraint_name: string
	foreign_table_name: string
	foreign_column_name: string
}

interface ViewRelationsEdge extends BaseNode {
	type: "viewRelations"
	view: string
	table: string
	columns: string[]
}

type RelationsDirectedGraph = Graph<
	TableColumnsViewNode,
	TableRelationsEdge | ViewRelationsEdge
>

export class RelationsGraphLoader {
	constructor(public graph: RelationsDirectedGraph) {}

	loadTableColumnsView(table_columns_view: TableColumnsView[]) {
		_.chain(table_columns_view)
			.groupBy((s) => s.table_name)
			.each((v, k) => {
				const nodeAttributes: TableColumnsViewNode = {
					type: "table",
					label: k,
					columns: v,
				}
				this.graph.mergeNode(k, nodeAttributes)
			})
			.value()
		return this
	}

	loadViewDependencies(view_dependencies: ViewDependencies[]) {
		view_dependencies.forEach((entry) => {
			_.each(entry.source_tables, (columns, tableName) => {
				this.graph.addDirectedEdge(tableName, entry.dependent_view, {
					type: "viewRelations",
					label: `${tableName} -> ${entry.dependent_view}`,
					view: entry.dependent_view,
					columns,
					table: tableName,
				})
			})
		})

		return this
	}

	loadRelations(relations: Relations[]) {
		relations.forEach((entry) => {
			const edgeAttributes: TableRelationsEdge = {
				type: "tableRelations",
				...entry,
				label: entry.constraint_name,
			}
			this.graph.addDirectedEdgeWithKey(
				entry.constraint_name,
				entry.foreign_table_name,
				entry.table_name,
				edgeAttributes
			)
		})
		return this
	}

	updateViewTypes(view_dependencies: ViewDependencies[]) {
		view_dependencies.forEach((entry) => {
			this.graph.updateNodeAttribute(
				entry.dependent_view,
				"type",
				() => "view"
			)
		})
		return this
	}
}

export function createDependencyGraph(
	table_columns_view: TableColumnsView[],
	relations: Relations[],
	view_dependencies: ViewDependencies[]
) {
	const graph: RelationsDirectedGraph = new Graph()
	new RelationsGraphLoader(graph)
		.loadTableColumnsView(table_columns_view)
		.loadViewDependencies(view_dependencies)
		.loadRelations(relations)
		.updateViewTypes(view_dependencies)

	return graph
}

function createEdge<const T1 extends string, const T2 extends string>(
	source: T1,
	target: T2
) {
	return {
		constraint_name: `${source}_to_${target}` as const,
		column_name: "column1",
		foreign_column_name: "column1",
		foreign_table_name: source,
		table_name: target,
	} as const satisfies Relations
}
function createTableColumnsView() {
	const tableColumnsView: TableColumnsView[] = []
	_.times(3, (i) => {
		i = i + 1
		const table_name = `table${i}`
		_.times(3, (j) => {
			j += 1
			const column_name = `column${j}`
			tableColumnsView.push({
				table_name,
				column_name,
				data_type: faker.database.type(),
			})
		})
	})
	_.times(3, (i) => {
		i = i + 1
		const table_name = `view${i}`
		_.times(3, (j) => {
			j += 1
			const column_name = `column${j}`
			tableColumnsView.push({
				table_name,
				column_name,
				data_type: faker.database.type(),
			})
		})
	})
	return tableColumnsView
}

export function createTestRelationGraphData() {
	const tableColumnsView = createTableColumnsView()

	const relations: Relations[] = [
		createEdge("table1", "table2"),
		createEdge("table1", "table3"),
	]
	const viewDependencies: ViewDependencies[] = [
		{
			dependent_view: "view1",
			source_tables: {
				table1: ["column1", "column2"],
				table2: ["column1"],
			},
		},
		{
			dependent_view: "view2",
			source_tables: {
				table2: ["column1", "column2"],
			},
		},
		{
			dependent_view: "view3",
			source_tables: {
				view1: ["column1", "column2"],
			},
		},
	]

	const graph = createDependencyGraph(
		tableColumnsView,
		relations,
		viewDependencies
	)

	return {
		graph,
		tableColumnsView,
		relations,
		viewDependencies,
	}
}
