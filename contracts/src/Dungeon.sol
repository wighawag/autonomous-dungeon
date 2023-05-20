// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "forge-deploy-proxy/ForgeDeploy_Proxied.sol";
import "./Extraction.sol";

contract Dungeon is Proxied {
    // ----------------------------------------------------------------------------------------------
    // CONSTANTS
    // ----------------------------------------------------------------------------------------------

    uint256 constant TOTAL = 24 * 3600;
    uint256 constant ACTION_epoch = 23 * 3600;
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
        bytes24 furtherActions
    );

    event StateUpdate(address indexed player, uint256 position, uint8 life);

    // ----------------------------------------------------------------------------------------------
    // TYPES
    // ----------------------------------------------------------------------------------------------

    struct Character {
        uint256 position;
        uint8 life;
    }

    struct Monster {
        uint8 life;
    }

    struct RoomStatus {
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

    struct Room {
        bool[4] exits;
        bool chest;
        bool monster;
    }

    mapping(uint256 => RoomStatus) public roomStatus;
    mapping(address => Character) public characters;
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

    function resolve(address player, bytes32 secret, Action[] calldata actions, bytes24 furtherActions) external {
        Commitment storage commitment = commitments[player];
        (uint32 epoch, bool commiting) = _epoch();

        require(!commiting, "IN_COMMITING_PHASE");
        require(commitment.epoch != 0, "NOTHING_TO_RESOLVE");
        require(commitment.epoch == epoch, "INVALID_epoch");

        _checkHash(commitment.hash, secret, actions, furtherActions);

        uint256 currentPosition = characters[player].position;
        Room memory currentRoom = computeRoom(roomHash(currentPosition));

        for (uint256 i = 0; i < actions.length; i++) {
            Action memory action = actions[i];
            Room memory newRoom = computeRoom(roomHash(action.position));
            if (_isValidMove(currentPosition, currentRoom, action.position, newRoom)) {
                currentPosition = action.position;
                currentRoom = newRoom;
            } else {
                // we do not continue when we encounter an invalid move
                // for simplicity, we still count was was computed so far
                break;
            }
        }

        characters[player].position = currentPosition;

        bytes24 hashResolved = commitment.hash;
        if (furtherActions != bytes24(0)) {
            commitment.hash = furtherActions;
        } else {
            commitment.epoch = 0; // used
        }

        emit CommitmentResolved(player, epoch, hashResolved, actions, furtherActions);

        // CommitmentResolved event contains everything needed for an indexer to recompute the state
        // but here for simplicity we emit the latest data just computed

        emit StateUpdate(player, currentPosition, characters[player].life);
    }

    function getEpoch() public view returns (uint256) {
        return (block.timestamp - START_TIMESTAMP) / TOTAL;
    }

    function isActionepoch() public view returns (bool) {
        return (block.timestamp - getEpoch() * TOTAL) < ACTION_epoch;
    }

    function getEpochHash(uint256 epochToGenerate) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(epochToGenerate));
    }

    function getEpochHash() public view returns (bytes32) {
        return getEpochHash(getEpoch());
    }

    function roomID(int32 x, int32 y) public pure returns (uint256) {
        //  BigInt(x) + 2n ** 31n + ((BigInt(y) + 2n ** 31n) << 32n);
        return uint256(int256(x) + 2 ** 31) + (uint256(int256(y) + 2 ** 31) << 32);
    }

    function roomCoords(uint256 id) public pure returns (int32 x, int32 y) {
        x = int32(int256(uint256(uint32(id))) - 2 ** 31);
        y = int32(int256(id >> 32) - 2 ** 31);
    }

    function roomHash(int32 x, int32 y) public view returns (bytes32) {
        return roomHash(roomID(x, y));
    }

    function roomHash(uint256 id) public view returns (bytes32) {
        return keccak256(abi.encodePacked(getEpochHash(), id));
    }

    function computeRoom(bytes32 roomHashData) public pure returns (Room memory) {
        // // take from the first 0 (right side) and take 2 bits to give you a number between [0,2**2[
        // const firstExit = value(roomHashData, 0, 2);
        uint8 firstExit = uint8(Extraction.value(roomHashData, 0, 2));

        // const hasSecondExit = value(roomHashData, 2, 5) < 3; // take 32 values [0,2**5[
        bool hasSecondExit = uint8(Extraction.value(roomHashData, 2, 5)) < 3;
        // const secondExitRaw = value(roomHashData, 7, 2); // this has one value too much.
        uint8 secondExitRaw = uint8(Extraction.value(roomHashData, 7, 2));
        // const secondExit = hasSecondExit && secondExitRaw < 3 ? secondExitRaw : 4;
        uint8 secondExit = (hasSecondExit && secondExitRaw < 3) ? secondExitRaw : 4;
        // // const thirdExist = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);
        // // const fourthExit = firstExit + ((Math.floor(Math.random() * 3) + 1) % 4);

        // const chest = value(roomHashData, 9, 10) < 7; // take 1024 values [0,2**10[
        bool chest = Extraction.value(roomHashData, 9, 10) < 7;

        // const monsterRaw = value(roomHashData, 19, 7); // take 128 values [0,2**7[
        uint8 monsterRaw = uint8(Extraction.value(roomHashData, 19, 7));
        // const monster = chest ? monsterRaw < 30 : monsterRaw < 1;
        bool monster = chest ? monsterRaw < 30 : monsterRaw < 1;

        return Room({
            exits: [
                firstExit == 0 || secondExit == 0,
                firstExit == 1 || secondExit == 1,
                firstExit == 2 || secondExit == 2,
                firstExit == 3 || secondExit == 3
            ],
            chest: chest,
            monster: monster
        });
    }

    // ----------------------------------------------------------------------------------------------
    // INTERNALS
    // ----------------------------------------------------------------------------------------------

    function _makeCommitment(address player, bytes24 commitmentHash) internal {
        Commitment storage commitment = commitments[player];

        (uint32 epoch, bool commiting) = _epoch();

        if (commitment.epoch != epoch) {
            // TODO make it count
            // if we set to zero life, then we should make it a separate tx, for anyone to claim ? instea do inside this if statement
            characters[msg.sender].life = 0;
            commitment.epoch = 0;

            emit CommitmentVoid(player, epoch);

            // CommitmentVoid event contains everything needed for an indexer to recompute the state
            // but here for simplicity we emit the latest data just computed
            emit StateUpdate(player, characters[player].position, 0);
        }

        require(commiting, "IN_RESOLUTION_PHASE");
        require(commitment.epoch == 0 || commitment.epoch == epoch, "PREVIOUS_COMMITMENT_TO_RESOLVE");

        commitment.hash = commitmentHash;
        commitment.epoch = epoch;

        // Note: A player can change its commitment at any time until the commit phase ends.
        emit CommitmentMade(player, epoch, commitmentHash);
    }

    function _checkHash(bytes24 commitmentHash, bytes32 secret, Action[] memory actions, bytes24 furtherActions)
        internal
        pure
    {
        if (furtherActions != bytes24(0)) {
            bytes24 computedHash = bytes24(keccak256(abi.encode(secret, actions, furtherActions)));
            require(commitmentHash == computedHash, "HASH_NOT_MATCHING");
        } else {
            bytes24 computedHash = bytes24(keccak256(abi.encode(secret, actions)));
            require(commitmentHash == computedHash, "HASH_NOT_MATCHING");
        }
    }

    function _epoch() internal view virtual returns (uint32 epoch, bool commiting) {
        uint256 epochDuration = TOTAL;

        // For now START_TIMESTAMP = 0
        require(block.timestamp >= START_TIMESTAMP, "GAME_NOT_STARTED");

        uint256 timePassed = block.timestamp - START_TIMESTAMP;
        epoch = uint32(timePassed / epochDuration + 1);
        commiting = timePassed - ((epoch - 1) * epochDuration) < ACTION_epoch;
    }

    function _isValidMove(uint256 roomPosition, Room memory room, uint256 newPosition, Room memory newRoom)
        internal
        pure
        returns (bool)
    {
        (int32 x, int32 y) = roomCoords(roomPosition);
        (int32 nx, int32 ny) = roomCoords(newPosition);
        uint8 direction = _direction(x, y, nx, ny);
        if (direction == 4) {
            return false;
        }
        return room.exits[direction] || newRoom.exits[direction + 2 % 4];
    }

    function _direction(int32 fromx, int32 fromy, int32 tox, int32 toy) internal pure returns (uint8) {
        int64 x_diff = int64(tox) - fromx;
        int64 y_diff = int64(toy) - fromy;
        if (x_diff == 0) {
            if (y_diff == 1) {
                return 2;
            } else if (y_diff == -1) {
                return 0;
            } else {
                return 4; // undefined
            }
        } else {
            if (x_diff == 1) {
                return 1;
            } else if (x_diff == -1) {
                return 3;
            } else {
                return 4; // undefined
            }
        }
    }
}
