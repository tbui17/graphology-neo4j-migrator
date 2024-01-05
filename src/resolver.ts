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
		result.source = target
		result.sourceAttributes = targetAttributes
		result.target = source
		result.targetAttributes = sourceAttributes
	}
	return result
}
