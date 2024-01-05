export const generatorMockData = {
	nodes: {
		":`view`": {
			properties: [
				{
					name: "name",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "id",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "type",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "columns",
					types: ["StringArray"],
					mandatory: true,
				},
				{
					name: "label",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "tables",
					types: ["StringArray"],
					mandatory: true,
				},
			],
			relationships: [],
			typeId: ":`view`",
			labels: ["view"],
		},
		":`table`": {
			properties: [
				{
					name: "id",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "type",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "columns",
					types: ["StringArray"],
					mandatory: true,
				},
				{
					name: "label",
					types: ["String"],
					mandatory: true,
				},
			],
			relationships: [],
			typeId: ":`table`",
			labels: ["table"],
		},
	},
	relationships: {
		view_relation: {
			paths: [
				{
					fromTypeId: ":`table`",
					toTypeId: ":`view`",
				},
				{
					fromTypeId: ":`view`",
					toTypeId: ":`view`",
				},
			],
			properties: [
				{
					name: "name",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "id",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "type",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "columns",
					types: ["StringArray"],
					mandatory: true,
				},
				{
					name: "label",
					types: ["String"],
					mandatory: true,
				},
			],
			type: "view_relation",
		},
		relation: {
			paths: [
				{
					fromTypeId: ":`table`",
					toTypeId: ":`table`",
				},
			],
			properties: [
				{
					name: "id",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "type",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "table_name",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "constraint_name",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "foreign_table_name",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "foreign_column_name",
					types: ["String"],
					mandatory: true,
				},
				{
					name: "table_columns",
					types: ["StringArray"],
					mandatory: true,
				},
				{
					name: "foreign_table_columns",
					types: ["StringArray"],
					mandatory: true,
				},
				{
					name: "column_name",
					types: ["String"],
					mandatory: true,
				},
			],
			type: "relation",
		},
	},
} as const

export const expectedFileContent = `import type Graph from "Graphology";
export type view = {
    name: string;
    id: string;
    type: string;
    columns: unknown;
    label: string;
    tables: unknown;
    _id: string;
    _labels: [
        "view"
    ];
    _type: "view";
};
export type table = {
    id: string;
    type: string;
    columns: unknown;
    label: string;
    _id: string;
    _labels: [
        "table"
    ];
    _type: "table";
};
export type view_relation = {
    name: string;
    id: string;
    type: string;
    columns: unknown;
    label: string;
    _id: string;
    _type: "view_relation";
};
export type relation = {
    id: string;
    type: string;
    table_name: string;
    constraint_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    table_columns: unknown;
    foreign_table_columns: unknown;
    column_name: string;
    _id: string;
    _type: "relation";
};
export type GraphNode = view | table;
export type GraphEdge = view_relation | relation;
export type Graph2 = Graph<GraphNode, GraphEdge>;
`
