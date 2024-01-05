import { type EdgeBuilderArgs } from "./types"

import { BindParam, QueryBuilder } from "neogma"

export function createNodeBuilder(
	data: Record<string, unknown>,
	nodeKey: string
) {
	const binds = new BindParam()
	binds.add(data)
	return unwindNode(nodeKey, new QueryBuilder(binds))
}

export function createEdgeBuilder(
	data: Record<string, unknown>,
	edgeArgs: EdgeBuilderArgs
) {
	const binds = new BindParam()
	binds.add(data)
	return unwindEdge(edgeArgs, new QueryBuilder(binds))
}

function unwindNode(nodeKey: string, builder: QueryBuilder) {
	const value = "v"

	const alias = "x"

	const nodeIdentifier = "n"
	return builder
		.with(`$${nodeKey} AS ${value}` as const)
		.unwind({
			value,
			as: alias,
		})
		.create({
			label: nodeKey,
			identifier: nodeIdentifier,
			properties: {
				id: `${alias}.id`,
			},
		})
		.set(`${nodeIdentifier} += ${alias}`)
}

function unwindEdge(
	{
		edgeType,
		direction,
		sourceIdField,
		sourceType,
		targetIdField,
		targetType,
		edgeAttributesFieldAccessor,
		edgeSourceFieldIdAccessor,
		edgeTargetFieldIdAccessor,
		compositeKey,
	}: EdgeBuilderArgs,
	builder: QueryBuilder
) {
	const nodeAIdentifier = `a`
	const nodeBIdentifier = `b`

	const edgeIdentifier = `r`

	const value = "v"

	const alias = "x"

	return builder
		.with(`$${compositeKey} AS ${value}` as const)
		.unwind({
			value,
			as: alias,
		})
		.match(`(${nodeAIdentifier}:${sourceType})`)
		.where(
			`${nodeAIdentifier}.${sourceIdField} = ${alias}.${edgeSourceFieldIdAccessor}`
		)
		.match(`(${nodeBIdentifier}:${targetType})`)
		.where(
			`${nodeBIdentifier}.${targetIdField} = ${alias}.${edgeTargetFieldIdAccessor}`
		)
		.create({
			related: [
				{
					identifier: nodeAIdentifier,
				},
				{
					identifier: edgeIdentifier,
					name: edgeType,
					direction,
				},
				{
					identifier: nodeBIdentifier,
				},
			],
		})

		.set(`${edgeIdentifier} = ${alias}.${edgeAttributesFieldAccessor}`)
}

// export class Builder extends QueryBuilder {
// 	unwindNode(nodeKey: string) {
// 		const value = "v"

// 		const alias = "x"

// 		const nodeIdentifier = "n"
// 		this.with(`$${nodeKey} AS ${value}` as const)
// 			.unwind({
// 				value,
// 				as: alias,
// 			})
// 			.create({
// 				label: nodeKey,
// 				identifier: nodeIdentifier,
// 				properties: {
// 					id: `${alias}.id`,
// 				},
// 			})
// 			.set(`${nodeIdentifier} += ${alias}`)

// 		return this
// 	}

// 	unwindEdge({
// 		edgeType,
// 		direction,
// 		sourceIdField,
// 		sourceType,
// 		targetIdField,
// 		targetType,
// 		edgeAttributesFieldAccessor,
// 		edgeSourceFieldIdAccessor,
// 		edgeTargetFieldIdAccessor,
// 		compositeKey,
// 	}: EdgeBuilderArgs): this {
// 		const nodeAIdentifier = `a`
// 		const nodeBIdentifier = `b`

// 		const edgeIdentifier = `r`

// 		const value = "v"

// 		const alias = "x"

// 		this.with(`$${compositeKey} AS ${value}` as const)
// 			.unwind({
// 				value,
// 				as: alias,
// 			})
// 			.match(`(${nodeAIdentifier}:${sourceType})`)
// 			.where(
// 				`${nodeAIdentifier}.${sourceIdField} = ${alias}.${edgeSourceFieldIdAccessor}`
// 			)
// 			.match(`(${nodeBIdentifier}:${targetType})`)
// 			.where(
// 				`${nodeBIdentifier}.${targetIdField} = ${alias}.${edgeTargetFieldIdAccessor}`
// 			)
// 			.create({
// 				related: [
// 					{
// 						identifier: nodeAIdentifier,
// 					},
// 					{
// 						identifier: edgeIdentifier,
// 						name: edgeType,
// 						direction,
// 					},
// 					{
// 						identifier: nodeBIdentifier,
// 					},
// 				],
// 			})

// 			.set(`${edgeIdentifier} = ${alias}.${edgeAttributesFieldAccessor}`)
// 		return this
// 	}
// }
