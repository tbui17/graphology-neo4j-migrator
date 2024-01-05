import mapValues from "lodash/mapValues"
import { z } from "zod"

const primitives = z.union([z.string(), z.number(), z.boolean()])
const primitiveArray = z.array(primitives)

export function stringifyNestedObjects<T extends object>(obj: T) {
	return mapValues(obj, (val) => {
		return helper(val)
	})
}

function helper(val: any) {
	if (val instanceof Date) {
		return val
	}
	if (Array.isArray(val)) {
		const res = primitiveArray.safeParse(val)
		if (!res.success) {
			return val.map((s) => JSON.stringify(s))
		}
		const [first, ...rest] = val
		if (first === undefined) {
			return val
		}
		const firstType = typeof first
		if (rest.some((s) => typeof s !== firstType)) {
			return val.map((s) => JSON.stringify(s))
		}
		return val
	}
	return typeof val === "object" && val !== null ? JSON.stringify(val) : val
}

type DeploymentConfig = {
	development: {
		server: string
		port: number
		features: {
			enableDebug: boolean
			loggingLevel: string
			container: {
				name: string
				image: string
			}
		}
	}
	production: {
		server: string
		port: number
		features: {
			enableDebug: boolean
			loggingLevel: string
			container: {
				name: string
				image: string
			}
		}
	}
}
