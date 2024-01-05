export class WhiteListError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "WhiteListError"
	}
}

export class MigrationError extends Error {
	constructor(
		message: string,
		public opts: { cause?: unknown }
	) {
		super(message)
		this.name = "MigrationError"
	}
}
