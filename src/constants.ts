import { type OptionalKeys, type IntrospectorConfigs } from "./types";


export const baseConfigs: OptionalKeys<IntrospectorConfigs> = {
	idFieldName: "_id",
	typeFieldName: "_type",
	labelFieldName: "_labels",
	typeFieldDelimiter: "_",
	graphName: "Graph2",
	graphNodeName: "GraphNode",
	graphEdgeName: "GraphEdge",
};
