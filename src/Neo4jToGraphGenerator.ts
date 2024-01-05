import { cypherToGraph } from "graphology-neo4j"
import type Graph from "graphology"
import { Neo4jTypeGen } from "./neo4jTypeGen"
import { type IntrospectorConfigs } from "./types"
import { baseConfigs } from "./constants"

export class Neo4jToGraphGenerator {
	private configs
	private typegen
	public driver

	constructor(configs: IntrospectorConfigs, typegen?: Neo4jTypeGen) {
		this.configs = {
			...baseConfigs,
			...configs,
		}
		this.typegen = typegen ?? new Neo4jTypeGen(this.configs)
		this.driver = this.configs.driver
	}

	async generateGraphTypes() {
		await this.typegen.run()
	}

	async generateGraph<TGraph extends Graph = Graph>() {
		const configs = this.configs
		const query = `MATCH (n)-[r]-(m)
RETURN n, r, m

UNION

MATCH (n)
WHERE NOT (n)--()
RETURN n, NULL as r, NULL as m
`
		const graph = await cypherToGraph(
			{
				driver: configs.driver,
			},
			query,
			undefined,
			{
				id: configs.idFieldName,
				labels: configs.labelFieldName,
				type: configs.typeFieldName,
			}
		)

		graph.updateEachNodeAttributes((_node, attr) => {
			const labelValue = attr[configs.labelFieldName]
			if (Array.isArray(labelValue)) {
				attr[configs.typeFieldName] = labelValue.join(
					configs.typeFieldDelimiter
				)
			}
			return attr
		})
		return graph as TGraph
	}

	async closeDriver() {
		await this.configs.driver.close()
	}
}
