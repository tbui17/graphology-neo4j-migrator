import _ from "lodash"

import { type QueryBuilder } from "neogma"

export class DataCollection<TData, TSchema> {
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
/**
 * Holds data for a batch of nodes or edges grouped by type.
 */

export type DataCollectionRecord<TData, TSchema> = Record<
	string,
	{
		data: TData[]
		schema: TSchema
		builder: QueryBuilder
	}
>
