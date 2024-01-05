export type GraphTestData = {
	viewRelations_table_out_view: ViewRelationsTableOutView
	viewRelations_view_out_view: ViewRelationsViewOutView
	tableRelations_table_out_table: TableRelationsTableOutTable
}

export type TableRelationsTableOutTable = {
	data: TableRelationsTableOutTableElement[]
	schema: Schema
	builder: TableRelationsTableOutTableBuilder
}

export type TableRelationsTableOutTableBuilder = {
	parameters: Parameter[]
	statement: string
	bindParam: PurpleBindParam
}

export type PurpleBindParam = {
	bind: PurpleBind
}

export type PurpleBind = {
	tableRelations_table_out_table: TableRelationsTableOutTableElement[]
}

export type TableRelationsTableOutTableElement = {
	edge: string
	source: string
	target: string
	direction: string
	attributes: TableRelationsTableOutTableAttributes
}

export type TableRelationsTableOutTableAttributes = {
	type: string
	constraint_name: string
	column_name: ColumnName
	foreign_column_name: ColumnName
	foreign_table_name: string
	table_name: string
	label: string
	id: string
}

export type ColumnName = "column1" | "column2"

export type Parameter = {
	with?: string
	unwind?: Unwind
	match?: string
	where?: string
	create?: Create
	set?: string
}

export type Create = {
	related: Related[]
}

export type Related = {
	identifier: string
	name?: string
	direction?: string
}

export type Unwind = {
	value: string
	as: string
}

export type Schema = {
	type: string
	sourceType: string
	targetType: string
	direction: string
}

export type ViewRelationsTableOutView = {
	data: ViewRelationsTableOutViewElement[]
	schema: Schema
	builder: ViewRelationsTableOutViewBuilder
}

export type ViewRelationsTableOutViewBuilder = {
	parameters: Parameter[]
	statement: string
	bindParam: FluffyBindParam
}

export type FluffyBindParam = {
	bind: FluffyBind
}

export type FluffyBind = {
	viewRelations_table_out_view: ViewRelationsTableOutViewElement[]
}

export type ViewRelationsTableOutViewElement = {
	edge: string
	source: string
	target: string
	direction: string
	attributes: ViewRelationsTableOutViewAttributes
}

export type ViewRelationsTableOutViewAttributes = {
	type: string
	label: string
	view: string
	columns: ColumnName[]
	table: string
	id: string
}

export type ViewRelationsViewOutView = {
	data: ViewRelationsTableOutViewElement[]
	schema: Schema
	builder: ViewRelationsViewOutViewBuilder
}

export type ViewRelationsViewOutViewBuilder = {
	parameters: Parameter[]
	statement: string
	bindParam: TentacledBindParam
}

export type TentacledBindParam = {
	bind: TentacledBind
}

export type TentacledBind = {
	viewRelations_view_out_view: ViewRelationsTableOutViewElement[]
}
