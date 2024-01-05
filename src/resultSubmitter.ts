import { type Collection } from "@discordjs/collection"

import { type Transaction } from "neo4j-driver"

import { mapValuesAsyncSettled } from "@tbui17/utils"
import { type QueryBuilder } from "neogma"

function getBuilderAmountOfItems(builder: QueryBuilder) {
	const items = builder.getBindParam().get()
	let amount = 0
	for (const key in items) {
		const arr = items[key]

		if (Array.isArray(arr)) {
			amount += arr.length
		}
	}
	return amount
}

export abstract class ResultSubmitter<K = string> {
	abstract type: "node" | "edge" | "indexes"
	constructor(
		private builders: Collection<K, QueryBuilder>,
		public transaction: Transaction,
		public shouldValidate = true
	) {}

	async run() {
		return await this.submitResult()
	}

	private async submitResult() {
		return await mapValuesAsyncSettled(this.builders, async (builder) => {
			const transactionResult = await builder.run(this.transaction)

			this.shouldValidate &&
				this.validateResult(transactionResult, builder)

			return {
				builder,
				transactionResult,
			}
		})
	}

	private validateResult(
		transactionResult: Awaited<ReturnType<QueryBuilder["run"]>>,
		builder: QueryBuilder
	) {
		const amt = this.getTransactionAmount(transactionResult)
		const originalItemAmount = getBuilderAmountOfItems(builder)
		if (amt !== originalItemAmount) {
			const data = {
				type: `${this.type}`,

				keys: Object.keys(builder.getBindParam().get()),
				summary: transactionResult.summary,
				message: `Expected ${originalItemAmount} ${this.type} to be created, but only ${amt} were created.`,
			}
			throw new (class extends Error {
				data = data
			})()
		}
	}

	protected abstract getTransactionAmount(
		transactionResult: Awaited<ReturnType<QueryBuilder["run"]>>
	): number
}

export class NodeResultSubmitter extends ResultSubmitter {
	type = "node" as const
	protected getTransactionAmount(
		transactionResult: Awaited<ReturnType<QueryBuilder["run"]>>
	) {
		return transactionResult.summary.updateStatistics.updates().nodesCreated
	}
}

export class EdgeResultSubmitter extends ResultSubmitter {
	type = "edge" as const
	protected getTransactionAmount(
		transactionResult: Awaited<ReturnType<QueryBuilder["run"]>>
	) {
		return transactionResult.summary.updateStatistics.updates()
			.relationshipsCreated
	}
}

export class NodeIndexSubmitter extends ResultSubmitter {
	type = "indexes" as const
	protected getTransactionAmount(
		transactionResult: Awaited<ReturnType<QueryBuilder["run"]>>
	) {
		return transactionResult.summary.updateStatistics.updates().indexesAdded
	}
}
