// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./Vessels.sol";

contract Characters is Vessels {
    function mint(uint256 tokenID, address to) external {
        // return _safeMint(to, id);
        return _transferFrom(address(0), to, tokenID, false);
    }
}
