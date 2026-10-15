// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVeiloraEscrowToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title VeiloraEscrowV2
 * @notice Version 2 job escrow with evaluator-approved refunds after submission.
 *         The escrow has no private key. Its only token outflows go to parties and
 *         legion recipients fixed in the CREATE2 terms.
 */
contract VeiloraEscrowV2 {
    struct Terms {
        uint32 factoryVersion;
        bytes32 jobId;
        address asset;
        uint256 budget;
        uint256 evaluatorFee;
        address client;
        address provider;
        address evaluator;
        address liegeSigner;
        uint16 legionCapBps;
        uint64 acceptBy;
        uint64 submitBy;
        uint64 evaluateWithin;
        uint64 expiresAt;
        bytes32 briefCommit;
        address[] legionRecipients;
    }

    bytes32 public constant RELEASE = keccak256("RELEASE");
    bytes32 public constant REFUND = keccak256("REFUND");
    bytes32 public constant REVISE = keccak256("REVISE");
    bytes32 public constant ACCEPT = keccak256("ACCEPT");
    bytes32 public constant DECLINE = keccak256("DECLINE");
    bytes32 public constant SUBMIT = keccak256("SUBMIT");
    uint64 public constant GRACE_PERIOD = 6 hours;
    uint64 public constant SILENT_EVALUATION_RELEASE_DELAY = 72 hours;
    uint256 public constant MAX_LEGION_RECIPIENTS = 64;

    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant OUTCOME_TYPEHASH = keccak256(
        "Outcome(bytes32 action,bytes32 payloadHash,uint256 nonce)"
    );
    bytes32 private constant PROVIDER_ACTION_TYPEHASH = keccak256(
        "ProviderAction(bytes32 action,bytes32 termsHash,uint256 nonce,uint64 deadline)"
    );
    bytes32 private constant PROVIDER_SUBMISSION_TYPEHASH = keccak256(
        "ProviderSubmission(bytes32 termsHash,bytes32 deliverableCommit,uint256 nonce,uint64 deadline)"
    );
    bytes32 private constant NAME_HASH = keccak256("VeiloraEscrow");
    bytes32 private constant VERSION_HASH = keccak256("2");
    uint256 private constant SECP256K1N_HALF =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    Terms public terms;
    address public immutable factory;
    bytes32 public immutable termsHash;
    uint256 public outcomeNonce;
    uint256 public providerNonce;
    uint64 public submitBy;
    uint64 public submittedAt;
    bytes32 public deliverableCommit;
    bool public accepted;
    bool public revised;
    bool public closed;
    bool private entered;
    mapping(bytes32 outcomeDigest => mapping(address signer => bool approved)) public outcomeApprovals;

    event ProviderAccepted(bytes32 indexed jobId);
    event ProviderDeclined(bytes32 indexed jobId);
    event DeliverableSubmitted(bytes32 indexed jobId, bytes32 indexed deliverableCommit, uint64 submittedAt);
    event DeadlineRevised(bytes32 indexed jobId, uint64 submitBy);
    event OutcomeApproved(bytes32 indexed outcomeDigest, address indexed signer);
    event EscrowClosed(bytes32 indexed jobId, bytes32 indexed outcome);

    error InvalidTerms();
    error NotFactory();
    error NotParty();
    error InvalidSignature();
    error InvalidState();
    error DeadlinePassed();
    error InsufficientFunding();
    error InvalidPayouts();
    error TransferFailed();
    error ReentrantCall();

    modifier nonReentrant() {
        if (entered) revert ReentrantCall();
        entered = true;
        _;
        entered = false;
    }

    constructor(Terms memory terms_) {
        if (msg.sender == address(0)) revert InvalidTerms();
        factory = msg.sender;
        if (
            terms_.factoryVersion != 2 || terms_.jobId == bytes32(0) || terms_.asset == address(0) ||
            terms_.budget == 0 || terms_.client == address(0) || terms_.provider == address(0) ||
            terms_.evaluator == address(0) || terms_.liegeSigner == address(0) ||
            terms_.client == terms_.provider || terms_.client == terms_.evaluator ||
            terms_.client == terms_.liegeSigner || terms_.provider == terms_.evaluator ||
            terms_.provider == terms_.liegeSigner || terms_.evaluator == terms_.liegeSigner ||
            terms_.budget > type(uint256).max - terms_.evaluatorFee || terms_.legionCapBps > 10_000 ||
            terms_.acceptBy <= block.timestamp || terms_.submitBy <= terms_.acceptBy ||
            terms_.evaluateWithin == 0 || terms_.expiresAt <= terms_.submitBy
        ) revert InvalidTerms();
        if (terms_.legionRecipients.length > MAX_LEGION_RECIPIENTS) revert InvalidTerms();
        address previous;
        for (uint256 i; i < terms_.legionRecipients.length; ++i) {
            address recipient = terms_.legionRecipients[i];
            if (
                recipient == address(0) || recipient == terms_.client || recipient == terms_.provider ||
                recipient == terms_.evaluator || recipient == terms_.liegeSigner || recipient <= previous
            ) revert InvalidTerms();
            previous = recipient;
        }
        terms = terms_;
        termsHash = keccak256(abi.encode(terms_));
        submitBy = terms_.submitBy;
    }

    receive() external payable {}

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function requiredFunding() public view returns (uint256) {
        return terms.budget + terms.evaluatorFee;
    }

    function isFunded() public view returns (bool) {
        return IVeiloraEscrowToken(terms.asset).balanceOf(address(this)) >= requiredFunding();
    }

    function hashOutcome(bytes32 action, bytes32 payloadHash) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(OUTCOME_TYPEHASH, action, payloadHash, outcomeNonce));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function hashProviderAction(bytes32 action, uint64 deadline) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(PROVIDER_ACTION_TYPEHASH, action, termsHash, providerNonce, deadline)
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function hashProviderSubmission(bytes32 commit, uint64 deadline) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(PROVIDER_SUBMISSION_TYPEHASH, termsHash, commit, providerNonce, deadline)
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function accept(bytes calldata providerSignature, uint64 signatureDeadline) external {
        if (closed || accepted || !isFunded()) revert InvalidState();
        if (block.timestamp > terms.acceptBy || signatureDeadline < block.timestamp || signatureDeadline > terms.acceptBy)
            revert DeadlinePassed();
        _verifyProvider(ACCEPT, signatureDeadline, providerSignature);
        accepted = true;
        emit ProviderAccepted(terms.jobId);
    }

    function decline(bytes calldata providerSignature, uint64 signatureDeadline) external nonReentrant {
        if (closed || accepted || submittedAt != 0 || !isFunded()) revert InvalidState();
        if (signatureDeadline < block.timestamp || signatureDeadline > terms.expiresAt) revert DeadlinePassed();
        _verifyProvider(DECLINE, signatureDeadline, providerSignature);
        _close(REFUND);
        _transferToken(terms.client, IVeiloraEscrowToken(terms.asset).balanceOf(address(this)));
        emit ProviderDeclined(terms.jobId);
    }

    function markSubmitted(
        bytes32 deliverableCommit_,
        bytes calldata providerSignature,
        uint64 signatureDeadline
    ) external {
        if (closed || !accepted || submittedAt != 0 || deliverableCommit_ == bytes32(0) || !isFunded())
            revert InvalidState();
        if (block.timestamp > uint256(submitBy) + GRACE_PERIOD || signatureDeadline < block.timestamp || signatureDeadline > uint256(submitBy) + GRACE_PERIOD)
            revert DeadlinePassed();
        address signer = _recover(hashProviderSubmission(deliverableCommit_, signatureDeadline), providerSignature);
        if (signer != terms.provider) revert InvalidSignature();
        ++providerNonce;
        submittedAt = uint64(block.timestamp);
        deliverableCommit = deliverableCommit_;
        emit DeliverableSubmitted(terms.jobId, deliverableCommit_, submittedAt);
    }

    function revise(uint64 newSubmitBy, bytes[] calldata signatures) external {
        if (closed || !accepted || submittedAt != 0 || revised || !isFunded()) revert InvalidState();
        if (newSubmitBy <= submitBy || newSubmitBy >= terms.expiresAt) revert InvalidTerms();
        bytes32 digest = hashOutcome(REVISE, keccak256(abi.encode(newSubmitBy)));
        _requireTwoSigners(digest, signatures);
        ++outcomeNonce;
        revised = true;
        submitBy = newSubmitBy;
        emit DeadlineRevised(terms.jobId, newSubmitBy);
    }

    /** A smart-account party may approve a specific EIP-712 outcome on-chain. */
    function approveOutcome(bytes32 digest) external {
        if (closed || !_isSigner(msg.sender)) revert NotParty();
        outcomeApprovals[digest][msg.sender] = true;
        emit OutcomeApproved(digest, msg.sender);
    }

    struct LegionPayout { address recipient; uint256 amount; }

    function releasePayloadHash(LegionPayout[] calldata legion) external view returns (bytes32) {
        if (submittedAt == 0) revert InvalidState();
        return keccak256(abi.encode(legion, deliverableCommit, submittedAt));
    }

    function refundPayloadHash() public view returns (bytes32) {
        if (submittedAt == 0) return bytes32(0);
        return keccak256(abi.encode(deliverableCommit, submittedAt));
    }

    function release(LegionPayout[] calldata legion, bytes[] calldata signatures) external nonReentrant {
        if (closed || submittedAt == 0 || !_withinEvaluationWindow()) revert InvalidState();
        bytes32 digest = hashOutcome(RELEASE, keccak256(abi.encode(legion, deliverableCommit, submittedAt)));
        bool evaluatorSigned = _requireTwoSigners(digest, signatures);
        uint256 delegated;
        for (uint256 i; i < legion.length; ++i) {
            LegionPayout calldata payout = legion[i];
            if (!_isLegionRecipient(payout.recipient) || payout.amount == 0) revert InvalidPayouts();
            for (uint256 j; j < i; ++j) if (legion[j].recipient == payout.recipient) revert InvalidPayouts();
            delegated += payout.amount;
        }
        if (delegated > (terms.budget * terms.legionCapBps) / 10_000) revert InvalidPayouts();
        if (!isFunded()) revert InsufficientFunding();
        _close(RELEASE);
        for (uint256 i; i < legion.length; ++i) _transferToken(legion[i].recipient, legion[i].amount);
        _transferToken(terms.provider, terms.budget - delegated);
        _payEvaluatorFee(evaluatorSigned);
    }

    function refund(bytes[] calldata signatures) external nonReentrant {
        if (closed || !_withinEvaluationWindow()) revert InvalidState();
        bytes32 digest = hashOutcome(REFUND, refundPayloadHash());
        bool evaluatorSigned = _requireTwoSigners(digest, signatures);
        if (submittedAt != 0 && !evaluatorSigned) revert InvalidSignature();
        if (!isFunded()) revert InsufficientFunding();
        _close(REFUND);
        _transferToken(terms.client, terms.budget);
        _payEvaluatorFee(evaluatorSigned);
    }

    /** Permissionless fallback: no submission means refund; evaluator silence means release. */
    function timeout() external nonReentrant {
        if (closed) revert InvalidState();
        if (submittedAt != 0) {
            uint256 releaseAt = uint256(submittedAt) + terms.evaluateWithin + SILENT_EVALUATION_RELEASE_DELAY + GRACE_PERIOD;
            if (block.timestamp < releaseAt) revert DeadlinePassed();
            if (!isFunded()) revert InsufficientFunding();
            _close(RELEASE);
            _transferToken(terms.provider, terms.budget);
            _transferToken(terms.client, terms.evaluatorFee);
            return;
        }
        uint256 noSubmissionRefundAt = uint256(submitBy) + GRACE_PERIOD;
        uint256 neverAcceptedRefundAt = uint256(terms.acceptBy) + GRACE_PERIOD;
        uint256 refundAt = accepted ? noSubmissionRefundAt : neverAcceptedRefundAt;
        if (block.timestamp < refundAt) revert DeadlinePassed();
        _close(REFUND);
        _transferToken(terms.client, IVeiloraEscrowToken(terms.asset).balanceOf(address(this)));
    }

    function cancelUnaccepted() external nonReentrant {
        if (closed || accepted || block.timestamp < uint256(terms.acceptBy) + GRACE_PERIOD) revert InvalidState();
        _close(REFUND);
        _transferToken(terms.client, IVeiloraEscrowToken(terms.asset).balanceOf(address(this)));
    }

    function sweepStray() external nonReentrant {
        if (!closed) revert InvalidState();
        uint256 tokenBalance = IVeiloraEscrowToken(terms.asset).balanceOf(address(this));
        if (tokenBalance > 0) _transferToken(terms.client, tokenBalance);
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            (bool ok,) = payable(terms.client).call{value: nativeBalance}("");
            if (!ok) revert TransferFailed();
        }
    }

    function _withinEvaluationWindow() private view returns (bool) {
        if (submittedAt == 0) return block.timestamp <= uint256(submitBy) + GRACE_PERIOD;
        return block.timestamp <= uint256(submittedAt) + terms.evaluateWithin + GRACE_PERIOD;
    }

    function _payEvaluatorFee(bool evaluatorSigned) private {
        if (terms.evaluatorFee == 0) return;
        _transferToken(evaluatorSigned ? terms.evaluator : terms.client, terms.evaluatorFee);
    }

    function _requireTwoSigners(bytes32 digest, bytes[] calldata signatures) private view returns (bool evaluatorSigned) {
        address[3] memory signers;
        uint256 count;
        address[3] memory roles = [terms.liegeSigner, terms.evaluator, terms.client];
        for (uint256 i; i < roles.length; ++i) {
            address signer = roles[i];
            if (signer == address(0)) continue;
            bool duplicate;
            for (uint256 j; j < count; ++j) if (signers[j] == signer) duplicate = true;
            if (duplicate) continue;
            if (outcomeApprovals[digest][signer]) { signers[count++] = signer; if (signer == terms.evaluator) evaluatorSigned = true; }
        }
        if (signatures.length > 3) revert InvalidSignature();
        for (uint256 i; i < signatures.length; ++i) {
            address signer = _recover(digest, signatures[i]);
            if (!_isSigner(signer)) revert InvalidSignature();
            bool duplicate;
            for (uint256 j; j < count; ++j) if (signers[j] == signer) duplicate = true;
            if (!duplicate) signers[count++] = signer;
            if (signer == terms.evaluator) evaluatorSigned = true;
        }
        if (count < 2) revert InvalidSignature();
    }

    function _verifyProvider(bytes32 action, uint64 deadline, bytes calldata signature) private {
        address signer = _recover(hashProviderAction(action, deadline), signature);
        if (signer != terms.provider) revert InvalidSignature();
        ++providerNonce;
    }

    function _isSigner(address candidate) private view returns (bool) {
        return candidate == terms.client || candidate == terms.evaluator || candidate == terms.liegeSigner;
    }

    function _isLegionRecipient(address candidate) private view returns (bool) {
        for (uint256 i; i < terms.legionRecipients.length; ++i) if (terms.legionRecipients[i] == candidate) return true;
        return false;
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address signer) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > SECP256K1N_HALF || (v != 27 && v != 28)) revert InvalidSignature();
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }

    function _close(bytes32 outcome) private {
        closed = true;
        ++outcomeNonce;
        emit EscrowClosed(terms.jobId, outcome);
    }

    function _transferToken(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, bytes memory data) = terms.asset.call(
            abi.encodeWithSelector(IVeiloraEscrowToken.transfer.selector, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
