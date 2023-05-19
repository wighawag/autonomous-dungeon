export type Position = {
	x: bigint;
	y: bigint;
};

export type Action = {
	type: 'move';
	to: Position;
};

export type OffchainState = {
	position: Position;
	actions: Action[];
};
