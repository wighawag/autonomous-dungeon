// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "solidity-kit/ERC721/implementations/BasicERC721.sol";

abstract contract Vessels is BasicERC721 {
    // ----------------------------------------------------------------------------------------------
    // EVENTS
    // ----------------------------------------------------------------------------------------------
    event VesselSlotUpdate(uint256 indexed id, address indexed namespace, uint256 indexed slot, bytes32 slotData);
    event VesselDataUpdate(uint256 indexed id, address indexed namespace, bytes data);

    // ----------------------------------------------------------------------------------------------
    // STORAGE
    // ----------------------------------------------------------------------------------------------
    mapping(uint256 => mapping(address => mapping(uint256 => bytes32))) _slots;
    mapping(uint256 => mapping(address => bytes)) _data;

    // ----------------------------------------------------------------------------------------------
    // PUBLIC INTERFACE
    // ----------------------------------------------------------------------------------------------

    /// @notice return the character's slot data for the caller's namespace
    function getSlot(uint256 id, uint256 index) external view returns (bytes32) {
        return _slots[id][msg.sender][index];
    }

    /// @notice return the character's slot data for the provided namespace
    function getSlotFor(uint256 id, address namespace, uint256 index) external view returns (bytes32) {
        return _slots[id][namespace][index];
    }

    /// @notice set the character's slot data on the caller's namespace
    function setSlot(uint256 id, uint256 index, bytes32 slotData) external {
        _setSlotFor(id, msg.sender, index, slotData);
    }

    // /// @notice set the character's slot data on the provided namespace
    // function setSlot(uint256 id, address namespace, uint256 index, bytes32 slotData) external {
    //     revert("NOT_IMPLEMENTED");
    //     // TODO allow delegation for other contract to setData on some other contract
    //     // require(msg.sender == );
    //     // _setSlotFor(id, msg.sender, index, slotData);
    // }

    /// @notice return the character's data for the caller's namespace
    function getData(uint256 id) external view returns (bytes memory) {
        return _data[id][msg.sender];
    }

    /// @notice return the character's data for the provided namespace
    function getDataFor(uint256 id, address namespace) external view returns (bytes memory) {
        return _data[id][namespace];
    }

    /// @notice set the character's data on the caller's namespace
    function setData(uint256 id, bytes calldata data) external {
        _setDataFor(id, msg.sender, data);
    }

    // /// @notice set the character's data on the provided namespace
    // function setData(uint256 id, address namespace, bytes calldata data) external {
    //     revert("NOT_IMPLEMENTED");
    //     // TODO allow delegation for other contract to setData on some other contract
    //     // require(msg.sender == );
    //     // _setDataFor(id, msg.sender, index, slotData);
    // }

    // ----------------------------------------------------------------------------------------------
    // INTERNAL
    // ----------------------------------------------------------------------------------------------
    function _setSlotFor(uint256 id, address namespace, uint256 index, bytes32 slotData) internal {
        _slots[id][namespace][index] = slotData;
        emit VesselSlotUpdate(id, namespace, index, slotData);
    }

    function _setDataFor(uint256 id, address namespace, bytes memory data) internal {
        _data[id][namespace] = data;
        emit VesselDataUpdate(id, namespace, data);
    }
}
