import { SwapBuilder } from "@tbui17/utils"
import { type OrderResolver as OrderResolver } from "./types"
import { type OrderResolverReturn } from "./types"
import { type HasType } from "./types"



export const orderResolver: OrderResolver = (
	source: string,
	sourceAttributes: HasType,
	target: string,
	targetAttributes: HasType
): OrderResolverReturn => {
	const result: OrderResolverReturn = {
		source,
		sourceAttributes,
		target,
		targetAttributes,
	}

	if (sourceAttributes.type > targetAttributes.type) {
		return new SwapBuilder(result)
			.swap("source", "target")
			.swap("sourceAttributes", "targetAttributes")
			.build()
	}
	return result
}
