import type Graph from "graphology"

import { type Attributes } from "graphology-types"

import { type Collection } from "@discordjs/collection"
import { type Neogma } from "neogma"

import { type ConditionalExcept } from "type-fest"
import { type Driver } from "neo4j-driver"
import { type toGenericStruct } from "@neo4j/introspector"

export type EdgeBuilderArgs = {
	sourceType: string
	targetType: string
	sourceIdField: string
	targetIdField: string
	edgeType: string
	direction: EdgeDirections
	compositeKey: string
	edgeSourceFieldIdAccessor: string
	edgeTargetFieldIdAccessor: string
	edgeAttributesFieldAccessor: string
}
export type OrderResolver = (
	source: string,
	sourceAttributes: HasType,
	target: string,
	targetAttributes: HasType
) => OrderResolverReturn
export type OrderResolverReturn = {
	source: string
	sourceAttributes: HasType
	target: string
	targetAttributes: HasType
}

export type HasType = { type: string; [key: string]: any }

export type GraphWithType<
	TNode extends HasType = HasType,
	TEdge extends HasType = HasType,
	TAttributes extends Attributes = Attributes,
> = Graph<TNode, TEdge, TAttributes>

export type Configs<TGraph extends Graph> = {
	whitelist: Set<string>
	typeSelector: (
		nodeAttribute: ReturnType<TGraph["getNodeAttributes"]>
	) => string
}
export type Container = {
	selectType(obj: object): string
}

export type EdgeDirections = "out" | "none"
export type ForEachAssymetricAdjacencyEntryWithOrphansObjectArgs<
	TNodeAttributes = Attributes,
	TNeighborAttributes = Attributes,
	TEdgeAttributes = Attributes,
> = {
	node: string
	neighbor: string | null
	nodeAttributes: TNodeAttributes
	neighborAttributes: TNeighborAttributes | null
	edge: string | null
	edgeAttributes: TEdgeAttributes | null
	undirected: boolean | null
}
export type ForEachAssymetricAdjacencyEntryWithOrphansCallbackArgs = Parameters<
	Parameters<Graph["forEachAssymetricAdjacencyEntryWithOrphans"]>[0]
>
export type NonNullableTuple<T> = {
	[P in keyof T]: NonNullable<T[P]>
}
export type CompositeKey = string
export type EdgeEntry = {
	edges: Collection<string, EdgeData>
	schema: EdgeSchemaData
}

export type EdgeData = {
	edge: string
	attributes: HasType
	source: string
	sourceAttributes: HasType
	target: string
	targetAttributes: HasType
	undirected: boolean
}
export type EdgeSchemaData<
	TEdgeType extends string = string,
	TSourceType extends string = string,
	TTargetType extends string = string,
> = {
	type: TEdgeType
	sourceType: TSourceType
	direction: EdgeDirections
	targetType: TTargetType
}
export type NodeEntry = {
	nodes: Collection<string, Attributes>
	schemaAttributeKeys: Set<string>
}
export type NeogmaCtorArgs = ConstructorParameters<typeof Neogma>
export type GraphToWizardArgs<
	TNode extends HasType,
	TEdge extends HasType,
	TAttributes extends Attributes,
> = {
	graph: GraphWithType<TNode, TEdge, TAttributes>
	connectionDetails: NeogmaCtorArgs[0]
	options?: NeogmaCtorArgs[1]
}
export type Partition<T> = {
	key: string
	value: T
}[]
export type OptionalKeys<T> = ConditionalExcept<OptionalKeysHelper<T>, never>
export type OptionalKeysHelper<T> = {
	[K in keyof T]-?: T extends Record<K, T[K]> ? never : T[K]
}
export type TypeProperty = {
	name: string
	types: string[]
	mandatory: boolean
}
export type IntrospectorConfigs = {
	driver: Driver
	typeFileDirectory: string
	idFieldName?: string
	typeFieldName?: string
	labelFieldName?: string
	typeFieldDelimiter?: string
	graphName?: string
	graphNodeName?: string
	graphEdgeName?: string
}
export type Neo4jStruct = Awaited<ReturnType<typeof toGenericStruct>>

