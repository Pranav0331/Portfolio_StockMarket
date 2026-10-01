package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.transaction.TransactionDto;
import com.portfolio.entity.Stock;
import com.portfolio.entity.Transaction;
import com.portfolio.entity.enums.TransactionType;
import com.portfolio.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
public class TransactionService {

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);

    private final TransactionRepository transactionRepository;

    public TransactionService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    @Transactional(readOnly = true)
    public PageResponseDto<TransactionDto> getUserTransactions(
            Long userId,
            String type,
            String symbol,
            Instant startDate,
            Instant endDate,
            int page,
            int size,
            String sortDirection
    ) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID must not be null");
        }

        // Validate and clamp pagination
        int pageIndex = Math.max(0, page);
        int pageSize = (size <= 0 || size > 100) ? 15 : size;

        // Determine sorting direction (default DESC = newest first)
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(direction, "createdAt"));

        // Parse TransactionType filter
        TransactionType transactionType = null;
        if (type != null && !type.trim().isEmpty() && !"ALL".equalsIgnoreCase(type.trim())) {
            try {
                transactionType = TransactionType.valueOf(type.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown transaction type filter: {}", type);
            }
        }

        // Parse symbol filter
        String cleanSymbol = (symbol != null && !symbol.trim().isEmpty())
                ? symbol.trim()
                : null;

        log.debug("Fetching transactions for user {}: type={}, symbol={}, startDate={}, endDate={}, page={}, size={}",
                userId, transactionType, cleanSymbol, startDate, endDate, pageIndex, pageSize);

        Page<Transaction> transactionPage = transactionRepository.findUserTransactions(
                userId,
                transactionType,
                cleanSymbol,
                startDate,
                endDate,
                pageable
        );

        List<TransactionDto> dtoList = transactionPage.getContent().stream()
                .map(this::mapToDto)
                .toList();

        return new PageResponseDto<>(
                dtoList,
                transactionPage.getNumber(),
                transactionPage.getSize(),
                transactionPage.getTotalElements(),
                transactionPage.getTotalPages(),
                transactionPage.isFirst(),
                transactionPage.isLast()
        );
    }

    private TransactionDto mapToDto(Transaction t) {
        Stock stock = t.getStock();
        String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
        String companyName = stock != null && stock.getCompanyName() != null ? stock.getCompanyName() : symbol;
        String exchange = stock != null && stock.getExchange() != null ? stock.getExchange() : "NSE";
        String currency = stock != null && stock.getCurrency() != null ? stock.getCurrency() : "USD";

        Long orderId = t.getOrder() != null ? t.getOrder().getId() : null;

        String status = "EXECUTED";
        if (t.getOrder() != null && t.getOrder().getOrderStatus() != null) {
            status = t.getOrder().getOrderStatus().name();
        } else if (t.getStatus() != null) {
            status = t.getStatus().name();
        }

        BigDecimal executionPrice = t.getPricePerUnit();
        if (executionPrice == null && t.getOrder() != null) {
            executionPrice = t.getOrder().getExecutedPrice();
        }
        if (executionPrice == null) {
            executionPrice = BigDecimal.ZERO;
        }

        Instant executedAt = t.getCreatedAt();
        if (executedAt == null && t.getOrder() != null) {
            executedAt = t.getOrder().getExecutedAt();
        }
        if (executedAt == null) {
            executedAt = Instant.now();
        }

        return new TransactionDto(
                t.getId(),
                orderId,
                symbol,
                companyName,
                exchange,
                currency,
                t.getTransactionType() != null ? t.getTransactionType().name() : "BUY",
                status,
                t.getQuantity() != null ? t.getQuantity() : BigDecimal.ZERO,
                executionPrice,
                t.getTotalAmount() != null ? t.getTotalAmount() : BigDecimal.ZERO,
                t.getFees() != null ? t.getFees() : BigDecimal.ZERO,
                executedAt
        );
    }
}
