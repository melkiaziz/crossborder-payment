// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CrossBorderPayment {

    // ================================
    // 🏦 CENTRAL BANK (OWNER)
    // ================================
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Central Bank allowed");
        _;
    }

    // ================================
    // 🏦 BANK STRUCTURE
    // ================================
    struct Bank {
        string name;
        string country;
        string currency;
        uint256 balance;
        bool isRegistered;
    }

    mapping(address => Bank) public banks;

    // ================================
    // 🚫 BLACKLIST (AML)
    // ================================
    mapping(address => bool) public blacklisted;

    function blacklistBank(address bank) public onlyOwner {
        blacklisted[bank] = true;
    }

    function removeFromBlacklist(address bank) public onlyOwner {
        blacklisted[bank] = false;
    }

    // ================================
    // 💱 FX RATES
    // ================================
    uint256 public eurToTndRate = 3.3 ether;
    uint256 public usdToTndRate = 3.1 ether;

    function updateEurRate(uint256 newRate) public onlyOwner {
        eurToTndRate = newRate;
    }

    function updateUsdRate(uint256 newRate) public onlyOwner {
        usdToTndRate = newRate;
    }

    // ================================
    // 💸 TRANSFER FEE
    // ================================
    uint256 public transferFeePercent = 1;

    function updateTransferFee(uint256 newFee) public onlyOwner {
        require(newFee <= 10, "Fee too high");
        transferFeePercent = newFee;
    }

    // ================================
    // 🏦 REGISTER BANK
    // ================================
    function registerBank(
        address bankAddress,
        string memory name,
        string memory country,
        string memory currency
    ) public onlyOwner {
        banks[bankAddress] = Bank(
            name,
            country,
            currency,
            0,
            true
        );
    }

    function addBalance(address bankAddress, uint256 amount)
        public
        onlyOwner
    {
        require(banks[bankAddress].isRegistered, "Not registered");
        banks[bankAddress].balance += amount;
        
        // ✅ Émettre l'événement BalanceAdded
        emit BalanceAdded(bankAddress, amount, banks[bankAddress].balance);
    }

    // ================================
    // 🥇 DAILY LIMIT SYSTEM
    // ================================
    mapping(address => uint256) public dailyTransferred;
    mapping(address => uint256) public lastTransferDay;

    uint256 public dailyLimit = 10000 ether;

    function _updateDailyLimit(address bank, uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;

        if (lastTransferDay[bank] < today) {
            dailyTransferred[bank] = 0;
            lastTransferDay[bank] = today;
        }

        require(
            dailyTransferred[bank] + amount <= dailyLimit,
            "Daily transfer limit exceeded"
        );

        dailyTransferred[bank] += amount;
    }

    // ================================
    // 🥈 MULTI-SIGNATURE SYSTEM
    // ================================
    uint256 public approvalThreshold = 5000 ether;

    struct PendingTransfer {
        address from;
        address to;
        uint256 amount;
        bool executed;
    }

    mapping(uint256 => PendingTransfer) public pendingTransfers;
    uint256 public pendingCount;

    // ================================
    // 📜 TRANSACTION STORAGE
    // ================================
    struct Transaction {
        address from;
        address to;
        uint256 originalAmount;
        uint256 convertedAmount;
        uint256 fee;
        uint256 timestamp;
    }

    Transaction[] public transactions;

    // ================================
    // 🔄 TRANSFER ENTRY FUNCTION (✅ UPDATED)
    // ================================
    function transfer(address toBank, uint256 amount) public {

        require(banks[msg.sender].isRegistered, "Sender not registered");
        require(banks[toBank].isRegistered, "Receiver not registered");
        require(!blacklisted[msg.sender], "Sender blacklisted");
        require(!blacklisted[toBank], "Receiver blacklisted");
        require(banks[msg.sender].balance >= amount, "Insufficient balance");

        // ✅ If large transfer → create pending + emit event
        if (amount > approvalThreshold) {
            pendingTransfers[pendingCount] = PendingTransfer(
                msg.sender,
                toBank,
                amount,
                false
            );
            
            // ✅ NOUVEAU : Émettre l'événement PendingTransferCreated
            emit PendingTransferCreated(
                pendingCount,
                msg.sender,
                toBank,
                amount
            );
            
            pendingCount++;
            return;
        }

        _executeTransfer(msg.sender, toBank, amount);
    }

    // ================================
    // 🏦 OWNER APPROVES LARGE TRANSFER (✅ UPDATED)
    // ================================
    function approveTransfer(uint256 id) public onlyOwner {
        PendingTransfer storage p = pendingTransfers[id];

        require(!p.executed, "Already executed");

        p.executed = true;

        // ✅ NOUVEAU : Émettre l'événement PendingTransferApproved
        emit PendingTransferApproved(id, p.from, p.to, p.amount);

        _executeTransfer(p.from, p.to, p.amount);
    }

    // ================================
    // ⚙ INTERNAL EXECUTION FUNCTION
    // ================================
    function _executeTransfer(
        address from,
        address toBank,
        uint256 amount
    ) internal {

        _updateDailyLimit(from, amount);

        Bank storage sender = banks[from];
        Bank storage receiver = banks[toBank];

        uint256 finalAmount = amount;

        bytes32 senderCurrency = keccak256(bytes(sender.currency));
        bytes32 receiverCurrency = keccak256(bytes(receiver.currency));

        if (senderCurrency == receiverCurrency) {
            finalAmount = amount;
        }
        else if (
            senderCurrency == keccak256(bytes("EUR")) &&
            receiverCurrency == keccak256(bytes("TND"))
        ) {
            finalAmount = (amount * eurToTndRate) / 1 ether;
        }
        else if (
            senderCurrency == keccak256(bytes("USD")) &&
            receiverCurrency == keccak256(bytes("TND"))
        ) {
            finalAmount = (amount * usdToTndRate) / 1 ether;
        }
        else if (
            senderCurrency == keccak256(bytes("TND")) &&
            receiverCurrency == keccak256(bytes("EUR"))
        ) {
            finalAmount = (amount * 1 ether) / eurToTndRate;
        }
        else if (
            senderCurrency == keccak256(bytes("TND")) &&
            receiverCurrency == keccak256(bytes("USD"))
        ) {
            finalAmount = (amount * 1 ether) / usdToTndRate;
        }
        else {
            revert("Currency pair not supported");
        }

        uint256 fee = (finalAmount * transferFeePercent) / 100;
        uint256 amountAfterFee = finalAmount - fee;

        sender.balance -= amount;
        receiver.balance += amountAfterFee;
        banks[owner].balance += fee;

        transactions.push(Transaction(
            from,
            toBank,
            amount,
            amountAfterFee,
            fee,
            block.timestamp
        ));

        emit TransferExecuted(
            from,
            toBank,
            amount,
            amountAfterFee,
            fee
        );
    }

    // ================================
    // 🔍 VIEW FUNCTIONS
    // ================================
    function getBalance(address bankAddress)
        public
        view
        returns (uint256)
    {
        return banks[bankAddress].balance;
    }

    function getTransactionCount()
        public
        view
        returns (uint256)
    {
        return transactions.length;
    }

    // ================================
    // 📢 EVENTS (✅ UPDATED)
    // ================================
    
    // Événement pour les transferts exécutés
    event TransferExecuted(
        address indexed fromBank,
        address indexed toBank,
        uint256 originalAmount,
        uint256 convertedAmount,
        uint256 fee
    );

    // ✅ NOUVEAU : Événement pour les pending transfers créés
    event PendingTransferCreated(
        uint256 indexed transferId,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    // ✅ NOUVEAU : Événement pour les pending transfers approuvés
    event PendingTransferApproved(
        uint256 indexed transferId,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    // ✅ NOUVEAU : Événement pour l'ajout de balance
    event BalanceAdded(
        address indexed bankAddress,
        uint256 amount,
        uint256 newBalance
    );
}
