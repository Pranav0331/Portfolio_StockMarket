package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.order.OrderDto;
import com.portfolio.entity.Order;
import com.portfolio.entity.Stock;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.TradingMode;
import com.portfolio.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public PageResponseDto<OrderDto> getUserOrders(
            Long userId,
            String type,
            String status,
            String tradingMode,
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

        int pageIndex = Math.max(0, page);
        int pageSize = (size <= 0 || size > 100) ? 15 : size;

        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(direction, "createdAt"));

        OrderType orderType = null;
        if (type != null && !type.trim().isEmpty() && !"ALL".equalsIgnoreCase(type.trim())) {
            try {
                orderType = OrderType.valueOf(type.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown order type filter: {}", type);
            }
        }

        OrderStatus orderStatus = null;
        if (status != null && !status.trim().isEmpty() && !"ALL".equalsIgnoreCase(status.trim())) {
            try {
                orderStatus = OrderStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown order status filter: {}", status);
            }
        }

        TradingMode mode = null;
        if (tradingMode != null && !tradingMode.trim().isEmpty() && !"ALL".equalsIgnoreCase(tradingMode.trim())) {
            try {
                mode = TradingMode.valueOf(tradingMode.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown trading mode filter: {}", tradingMode);
            }
        }

        String cleanSymbol = (symbol != null && !symbol.trim().isEmpty())
                ? symbol.trim()
                : null;

        log.debug("Fetching orders for user {}: type={}, status={}, mode={}, symbol={}, page={}, size={}",
                userId, orderType, orderStatus, mode, cleanSymbol, pageIndex, pageSize);

        Page<Order> orderPage = orderRepository.findUserOrders(
                userId,
                orderType,
                orderStatus,
                mode,
                cleanSymbol,
                startDate,
                endDate,
                pageable
        );

        List<OrderDto> dtoList = orderPage.getContent().stream()
                .map(this::mapToDto)
                .toList();

        return new PageResponseDto<>(
                dtoList,
                orderPage.getNumber(),
                orderPage.getSize(),
                orderPage.getTotalElements(),
                orderPage.getTotalPages(),
                orderPage.isFirst(),
                orderPage.isLast()
        );
    }

    @Transactional(readOnly = true)
    public PageResponseDto<OrderDto> getUserOrders(
            Long userId,
            String type,
            String status,
            String symbol,
            Instant startDate,
            Instant endDate,
            int page,
            int size,
            String sortDirection
    ) {
        return getUserOrders(userId, type, status, null, symbol, startDate, endDate, page, size, sortDirection);
    }

    private OrderDto mapToDto(Order o) {
        Stock stock = o.getStock();
        String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
        String companyName = stock != null && stock.getCompanyName() != null ? stock.getCompanyName() : symbol;
        String exchange = stock != null && stock.getExchange() != null ? stock.getExchange() : "NSE";
        String currency = stock != null && stock.getCurrency() != null ? stock.getCurrency() : "USD";

        BigDecimal price = o.getPrice() != null ? o.getPrice() : BigDecimal.ZERO;
        BigDecimal execPrice = o.getExecutedPrice() != null ? o.getExecutedPrice() : price;
        BigDecimal quantity = o.getQuantity() != null ? o.getQuantity() : BigDecimal.ZERO;
        BigDecimal totalAmount = execPrice.multiply(quantity).setScale(4, RoundingMode.HALF_UP);
        String tradingMode = o.getTradingMode() != null ? o.getTradingMode().name() : "INTRADAY";
        String positionSide = o.getPositionSide() != null ? o.getPositionSide().name() : "LONG";
        Integer leverage = o.getLeverage() != null ? o.getLeverage() : 1;
        BigDecimal marginUsed = o.getMarginUsed() != null ? o.getMarginUsed() : BigDecimal.ZERO;

        return new OrderDto(
                o.getId(),
                symbol,
                companyName,
                exchange,
                currency,
                o.getOrderType() != null ? o.getOrderType().name() : "BUY",
                o.getOrderStatus() != null ? o.getOrderStatus().name() : "EXECUTED",
                tradingMode,
                positionSide,
                leverage,
                marginUsed,
                o.getStopLoss(),
                o.getTakeProfit(),
                o.getPositionId(),
                o.getRealizedPnl(),
                quantity,
                price,
                execPrice,
                totalAmount,
                o.getExecutedAt(),
                o.getCreatedAt()
        );
    }
}
