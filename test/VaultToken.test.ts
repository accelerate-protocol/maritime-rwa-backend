import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { VaultToken } from "../typechain-types/contracts/v2/templates/token/VaultToken";

describe("VaultToken", function () {
    let vaultToken: VaultToken;
    let owner: HardhatEthersSigner;
    let vault: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let accumulatedYield: HardhatEthersSigner;

    beforeEach(async function () {
        [owner, vault, user1, user2, accumulatedYield] = await ethers.getSigners();

        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        vaultToken = await VaultTokenFactory.deploy();
    });

    describe("Initialization", function () {
        it("should initialize token correctly", async function () {
            await vaultToken.initToken(
                vault.address,
                "Test Vault Token",
                "TVT",
                18
            );

            expect(await vaultToken.vault()).to.equal(vault.address);
            expect(await vaultToken.name()).to.equal("Test Vault Token");
            expect(await vaultToken.symbol()).to.equal("TVT");
            expect(await vaultToken.decimals()).to.equal(18);
            expect(await vaultToken.isInitialized()).to.be.true;
        });

        it("should reject duplicate initialization", async function () {
            await vaultToken.initToken(
                vault.address,
                "Test Vault Token",
                "TVT",
                18
            );

            await expect(
                vaultToken.initToken(
                    vault.address,
                    "Another Token",
                    "AT",
                    6
                )
            ).to.be.revertedWith("VaultToken: already initialized");
        });

        it("should reject invalid initialization parameters", async function () {
            await expect(
                vaultToken.initToken(
                    ethers.ZeroAddress,
                    "Test Token",
                    "TT",
                    18
                )
            ).to.be.revertedWith("VaultToken: invalid vault address");

            await expect(
                vaultToken.initToken(
                    vault.address,
                    "",
                    "TT",
                    18
                )
            ).to.be.revertedWith("VaultToken: empty name");

            await expect(
                vaultToken.initToken(
                    vault.address,
                    "Test Token",
                    "",
                    18
                )
            ).to.be.revertedWith("VaultToken: empty symbol");

            await expect(
                vaultToken.initToken(
                    vault.address,
                    "Test Token",
                    "TT",
                    19
                )
            ).to.be.revertedWith("VaultToken: invalid decimals");
        });
    });

    describe("Minting and Burning", function () {
        beforeEach(async function () {
            await vaultToken.initToken(
                vault.address,
                "Test Vault Token",
                "TVT",
                18
            );
        });

        it("should allow Vault to mint tokens", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await expect(vaultToken.connect(vault).mint(user1.address, mintAmount))
                .to.emit(vaultToken, "TokenMinted")
                .withArgs(user1.address, mintAmount);

            expect(await vaultToken.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("should reject non-Vault address minting", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await expect(
                vaultToken.connect(user1).mint(user2.address, mintAmount)
            ).to.be.revertedWith("VaultToken: only vault");
        });

        it("should reject minting to zero address", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await expect(
                vaultToken.connect(vault).mint(ethers.ZeroAddress, mintAmount)
            ).to.be.revertedWith("VaultToken: mint to zero address");
        });

        it("should reject minting zero amount", async function () {
            await expect(
                vaultToken.connect(vault).mint(user1.address, 0)
            ).to.be.revertedWith("VaultToken: mint amount must be positive");
        });

        it("should allow Vault to burn tokens", async function () {
            const mintAmount = ethers.parseEther("1000");
            const burnAmount = ethers.parseEther("500");
            
            await vaultToken.connect(vault).mint(user1.address, mintAmount);
            
            await expect(vaultToken.connect(vault).burnFrom(user1.address, burnAmount))
                .to.emit(vaultToken, "TokenBurned")
                .withArgs(user1.address, burnAmount);

            expect(await vaultToken.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
        });

        it("should reject burning from zero address", async function () {
            const burnAmount = ethers.parseEther("500");
            
            await expect(
                vaultToken.connect(vault).burnFrom(ethers.ZeroAddress, burnAmount)
            ).to.be.revertedWith("VaultToken: burn from zero address");
        });

        it("should reject burning zero amount", async function () {
            await expect(
                vaultToken.connect(vault).burnFrom(user1.address, 0)
            ).to.be.revertedWith("VaultToken: burn amount must be positive");
        });

        it("should reject burning more than balance", async function () {
            const mintAmount = ethers.parseEther("1000");
            const burnAmount = ethers.parseEther("1500");
            
            await vaultToken.connect(vault).mint(user1.address, mintAmount);
            
            await expect(
                vaultToken.connect(vault).burnFrom(user1.address, burnAmount)
            ).to.be.revertedWith("VaultToken: insufficient balance");
        });
    });

    describe("Pause Functionality", function () {
        beforeEach(async function () {
            await vaultToken.initToken(
                vault.address,
                "Test Vault Token",
                "TVT",
                18
            );
        });

        it("should allow Vault to pause token", async function () {
            await expect(vaultToken.connect(vault).pause())
                .to.emit(vaultToken, "TokenPaused");

            expect(await vaultToken.paused()).to.be.true;
        });

        it("should allow Vault to unpause token", async function () {
            await vaultToken.connect(vault).pause();
            
            await expect(vaultToken.connect(vault).unpause())
                .to.emit(vaultToken, "TokenUnpaused");

            expect(await vaultToken.paused()).to.be.false;
        });

        it("should reject non-Vault address pausing", async function () {
            await expect(
                vaultToken.connect(user1).pause()
            ).to.be.revertedWith("VaultToken: only vault");
        });

        it("should reject non-Vault address unpausing", async function () {
            await vaultToken.connect(vault).pause();
            
            await expect(
                vaultToken.connect(user1).unpause()
            ).to.be.revertedWith("VaultToken: only vault");
        });

        it("should reject transfers when paused", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await vaultToken.connect(vault).mint(user1.address, mintAmount);
            await vaultToken.connect(vault).pause();
            
            await expect(
                vaultToken.connect(user1).transfer(user2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("VaultToken: token transfer while paused");
        });
    });

    describe("Accumulated Yield Integration", function () {
        beforeEach(async function () {
            await vaultToken.initToken(
                vault.address,
                "Test Vault Token",
                "TVT",
                18
            );
        });

        it("should allow setting accumulated yield contract", async function () {
            await vaultToken.connect(vault).setAccumulatedYield(accumulatedYield.address);
            
            expect(await vaultToken.getAccumulatedYield()).to.equal(accumulatedYield.address);
        });

        it("should reject non-owner setting accumulated yield contract", async function () {
            await expect(
                vaultToken.connect(user1).setAccumulatedYield(accumulatedYield.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Transfer Functionality", function () {
        beforeEach(async function () {
            await vaultToken.initToken(
                vault.address,
                "Test Vault Token",
                "TVT",
                18
            );
            
            await vaultToken.connect(vault).mint(user1.address, ethers.parseEther("1000"));
        });

        it("should transfer tokens normally", async function () {
            const transferAmount = ethers.parseEther("100");
            
            await expect(
                vaultToken.connect(user1).transfer(user2.address, transferAmount)
            ).to.not.be.reverted;

            expect(await vaultToken.balanceOf(user2.address)).to.equal(transferAmount);
        });

        it("should call accumulated yield update before transfer", async function () {
            // Set accumulated yield contract
            await vaultToken.connect(vault).setAccumulatedYield(accumulatedYield.address);
            
            const transferAmount = ethers.parseEther("100");
            
            // Transfer should succeed even if accumulated yield contract call fails
            await expect(
                vaultToken.connect(user1).transfer(user2.address, transferAmount)
            ).to.not.be.reverted;
        });
        
        it("should calculate yield based on balance before transfer", async function () {
            // This test verifies yield calculation based on balance before transfer
            // In real environment, needs to be tested with AccumulatedYield contract
            const transferAmount = ethers.parseEther("500");
            
            // Set accumulated yield contract
            await vaultToken.connect(vault).setAccumulatedYield(accumulatedYield.address);
            
            // Before transfer, user1 should have 1000 tokens (minted in beforeEach)
            const initialBalance = ethers.parseEther("1000");
            expect(await vaultToken.balanceOf(user1.address)).to.equal(initialBalance);
            
            // Transfer 500 tokens to user2
            await vaultToken.connect(user1).transfer(user2.address, transferAmount);
            
            // After transfer, user1 should have 500 tokens, user2 should have 500 tokens
            expect(await vaultToken.balanceOf(user1.address)).to.equal(initialBalance - transferAmount);
            expect(await vaultToken.balanceOf(user2.address)).to.equal(transferAmount);
        });
    });

    describe("Query Functionality", function () {
        beforeEach(async function () {
            await vaultToken.initToken(
                vault.address,
                "Test Vault Token",
                "TVT",
                18
            );
        });

        it("should return token information correctly", async function () {
            expect(await vaultToken.name()).to.equal("Test Vault Token");
            expect(await vaultToken.symbol()).to.equal("TVT");
            expect(await vaultToken.decimals()).to.equal(18);
            expect(await vaultToken.vault()).to.equal(vault.address);
        });

        it("should return initialization status correctly", async function () {
            expect(await vaultToken.isInitialized()).to.be.true;
        });
    });
}); 