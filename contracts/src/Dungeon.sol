// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-deploy-proxy/ForgeDeploy_Proxied.sol";

contract Dungeon is Proxied {
    // ----------------------------------------------------------------------------------------------
    // CONSTANTS
    // ----------------------------------------------------------------------------------------------

    uint256 constant TOTAL = 24 * 3600;
    uint256 constant ACTION_PERIOD = 23 * 3600;
    uint256 constant START_TIMESTAMP = 0;

    // ----------------------------------------------------------------------------------------------
    // EVENTS
    // ----------------------------------------------------------------------------------------------
    event CommitmentMade(address indexed player, uint32 indexed epoch, bytes24 commitmentHash);
    event CommitmentVoid(address indexed player, uint32 indexed epoch);
    event CommitmentResolved(
        address indexed player,
        uint32 indexed epoch,
        bytes24 indexed commitmentHash,
        Action[] actions,
        bytes24 furtherMoves
    );

    // ----------------------------------------------------------------------------------------------
    // TYPES
    // ----------------------------------------------------------------------------------------------

    struct Monster {
        uint8 life;
    }

    struct Room {
        Monster monsterStatus;
        bool treasureTaken;
    }

    struct Commitment {
        bytes24 hash;
        uint32 epoch;
    }

    struct Action {
        uint256 position; // TODO uint64
    }

    mapping(uint256 => Room) public rooms;
    mapping(address => Commitment) public commitments;

    // ----------------------------------------------------------------------------------------------
    // STORAGE
    // ----------------------------------------------------------------------------------------------

    // ----------------------------------------------------------------------------------------------
    // CONSTRUCTOR / INITIALIZER
    // ----------------------------------------------------------------------------------------------

    constructor() {
        postUpgrade();
    }

    function postUpgrade() public proxied {}

    // ----------------------------------------------------------------------------------------------
    // PUBLIC INTERFACE
    // ----------------------------------------------------------------------------------------------

    function makeCommitment(bytes24 commitmentHash) external {
        _makeCommitment(msg.sender, commitmentHash);
    }

    function epoch() public returns (uint256) {
        return (block.timestamp - START_TIMESTAMP) / TOTAL;
    }

    function isActionPeriod() public returns (bool) {
        return (block.timestamp - epoch() * TOTAL) < ACTION_PERIOD;
    }

    function epochHash(uint256 epochToGenerate) public returns (bytes32) {
        return keccak256(abi.encodePacked(epochToGenerate));
    }

    function epochHash() public returns (bytes32) {
        return epochHash(epoch());
    }

    function roomID(int32 x, int32 y) public returns (uint256) {
        //  BigInt(x) + 2n ** 31n + ((BigInt(y) + 2n ** 31n) << 32n);
        return uint256(int256(x) + 2 ** 31) + (uint256(int256(y) + 2 ** 31) << 32);
    }

    function roomHash(int32 x, int32 y) public returns (bytes32) {
        return roomHash(roomID(x, y));
    }

    function roomHash(uint256 id) public returns (bytes32) {
        return keccak256(abi.encodePacked(epochHash(), id));
    }

    // ----------------------------------------------------------------------------------------------
    // INTERNALS
    // ----------------------------------------------------------------------------------------------

    function _makeCommitment(address player, bytes24 commitmentHash) internal {
        Commitment storage commitment = commitments[player];

        (uint32 epoch, bool commiting) = _epoch();

        require(commiting, "IN_RESOLUTION_PHASE");
        require(commitment.epoch == 0 || commitment.epoch == epoch, "PREVIOUS_COMMITMENT_TO_RESOLVE");

        commitment.hash = commitmentHash;
        commitment.epoch = epoch;

        emit CommitmentMade(player, epoch, commitmentHash);
    }

    function _epoch() internal view virtual returns (uint32 epoch, bool commiting) {
        uint256 epochDuration = TOTAL;

        // For now START_TIMESTAMP = 0
        require(block.timestamp >= START_TIMESTAMP, "GAME_NOT_STARTED");

        uint256 timePassed = block.timestamp - START_TIMESTAMP;
        epoch = uint32(timePassed / epochDuration + 1);
        commiting = timePassed - ((epoch - 1) * epochDuration) < ACTION_PERIOD;
    }
}
