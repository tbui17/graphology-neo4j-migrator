/* eslint-disable @typescript-eslint/dot-notation */
import { describe, expect, it, beforeEach, vi, type MockInstance } from "vitest"

import { Neo4jToGraphGenerator, type IntrospectorConfigs } from ".."
import {
	expectedFileContent,
	generatorMockData,
} from "./testUtils/neo4jGraphGeneratorTestData"
import _ from "lodash"

describe("Neo4jTypeGen", () => {
	let generator: Neo4jToGraphGenerator

	let introspectorFetchSpy: MockInstance<any[], any>
	let saveSpy: MockInstance<any[], any>

	beforeEach(() => {
		const mockConfigs: IntrospectorConfigs = {
			typeFileDirectory: "/path/to/type/files",
			//@ts-expect-error mock
			driver: vi.fn(),
		}

		generator = new Neo4jToGraphGenerator(mockConfigs)
		saveSpy = vi.spyOn(generator["typegen"], "save" as any)
		introspectorFetchSpy = vi
			.spyOn(generator["typegen"]["introspector"], "fetch")
			.mockReturnValue(generatorMockData as any)
	})

	it("should generate expected type string from mock data", async () => {
		await generator.generateGraphTypes()
		expect(introspectorFetchSpy).toHaveBeenCalledOnce()
		expect(saveSpy).toHaveBeenCalledOnce()
		const file = generator["typegen"]["file"]
		expect(file.print()).toBe(expectedFileContent)
		return
	})
})
