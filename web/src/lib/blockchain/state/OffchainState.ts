export type Position = {
	x: bigint;
	y: bigint;
};

export type OffchainState = {
	position: Position;
	path: Position[];
};
