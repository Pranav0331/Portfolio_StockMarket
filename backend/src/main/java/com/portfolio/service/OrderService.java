package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.order.ConsolidatedTradeDto;
import com.portfolio.dto.order.OrderDto;
import com.portfolio.dto.trading.PositionDto;
import com.portfolio.entity.Order;
import com.portfolio.entity.Stock;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.PositionSide;
import com.portfolio.entity.enums.PositionStatus;
import com.portfolio.entity.enums.TradingMode;
import com.portfolio.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;
    private final TradingService tradingService;

    public OrderService(OrderRepository orderRepository) {
        this(orderRepository, null);
    }

    @Autowired
    public OrderService(OrderRepository orderRepository, @Lazy TradingService tradingService) {
        this.orderRepository = orderRepository;
        this.tradingService = tradingService;
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

    @Transactional(readOnly = true)
    public PageResponseDto<ConsolidatedTradeDto> getUserConsolidatedTrades(
            Long userId,
            String symbol,
            String status,
            String direction,
            String tradingMode,
            Instant startDate,
            Instant endDate,
            int page,
            int size,
            String sortDirection
    ) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID must not be null");
        }

        // 1. Fetch positions for user
        List<PositionDto> positions = Collections.emptyList();
        if (tradingService != null) {
            try {
                positions = tradingService.getUserPositions(userId, null, null);
            } catch (Exception e) {
                log.warn("Could not fetch positions via TradingService: {}", e.getMessage());
            }
        }

        // 2. Fetch all user executed orders that have a positionId
        List<Order> ordersWithPos = orderRepository.findByUserIdAndPositionIdIsNotNullOrderByCreatedAtAsc(userId);
        Map<Long, List<Order>> ordersByPositionId = ordersWithPos.stream()
                .filter(o -> o.getPositionId() != null)
                .collect(Collectors.groupingBy(Order::getPositionId));

        List<ConsolidatedTradeDto> trades = new ArrayList<>();
        Set<Long> processedPositionIds = new HashSet<>();

        // 3. Build trades from positions
        for (PositionDto pos : positions) {
            if (pos.id() == null) continue;
            Long posId = pos.id();
            processedPositionIds.add(posId);

            List<Order> relatedOrders = ordersByPositionId.getOrDefault(posId, Collections.emptyList());

            Order entryOrder = null;
            Order exitOrder = null;

            boolean isLong = pos.side() == null || pos.side() == PositionSide.LONG;

            for (Order o : relatedOrders) {
                if (entryOrder == null && (isLong ? o.getOrderType() == OrderType.BUY : o.getOrderType() == OrderType.SELL)) {
                    entryOrder = o;
                } else if (exitOrder == null && (isLong ? o.getOrderType() == OrderType.SELL : o.getOrderType() == OrderType.BUY)) {
                    exitOrder = o;
                }
            }

            // Fallback for entry order: first order if not resolved
            if (entryOrder == null && !relatedOrders.isEmpty()) {
                entryOrder = relatedOrders.get(0);
            }
            // Fallback for exit order if closed and has 2nd order
            if (exitOrder == null && relatedOrders.size() > 1 && pos.status() == PositionStatus.CLOSED) {
                exitOrder = relatedOrders.get(relatedOrders.size() - 1);
            }

            Long entryOrderId = entryOrder != null ? entryOrder.getId() : null;
            Long exitOrderId = exitOrder != null ? exitOrder.getId() : null;

            BigDecimal entryPrice = pos.entryPrice() != null ? pos.entryPrice()
                    : (entryOrder != null && entryOrder.getExecutedPrice() != null ? entryOrder.getExecutedPrice() : BigDecimal.ZERO);
            BigDecimal exitPrice = pos.status() == PositionStatus.CLOSED ? (pos.closePrice() != null ? pos.closePrice()
                    : (exitOrder != null && exitOrder.getExecutedPrice() != null ? exitOrder.getExecutedPrice() : null)) : null;

            BigDecimal realizedPnl = pos.status() == PositionStatus.CLOSED ? (pos.realizedPnl() != null ? pos.realizedPnl()
                    : (exitOrder != null && exitOrder.getRealizedPnl() != null ? exitOrder.getRealizedPnl() : BigDecimal.ZERO)) : null;

            BigDecimal currentPrice = pos.status() == PositionStatus.OPEN ? pos.currentPrice() : exitPrice;
            BigDecimal unrealizedPnl = pos.status() == PositionStatus.OPEN ? pos.unrealizedPnl() : null;
            BigDecimal unrealizedPnlPercent = pos.status() == PositionStatus.OPEN ? pos.unrealizedPnlPercent() : null;

            Instant openTime = entryOrder != null && entryOrder.getExecutedAt() != null ? entryOrder.getExecutedAt()
                    : (entryOrder != null && entryOrder.getCreatedAt() != null ? entryOrder.getCreatedAt() : pos.createdAt());
            Instant closeTime = pos.status() == PositionStatus.CLOSED
                    ? (exitOrder != null && exitOrder.getExecutedAt() != null ? exitOrder.getExecutedAt()
                    : (exitOrder != null && exitOrder.getCreatedAt() != null ? exitOrder.getCreatedAt() : pos.closeTime()))
                    : null;

            trades.add(new ConsolidatedTradeDto(
                    posId,
                    entryOrderId,
                    exitOrderId,
                    pos.symbol(),
                    pos.companyName(),
                    pos.exchange(),
                    pos.currency(),
                    pos.side() != null ? pos.side().name() : (isLong ? "LONG" : "SHORT"),
                    pos.tradingMode() != null ? pos.tradingMode().name() : "INTRADAY",
                    pos.leverage() != null ? pos.leverage() : 1,
                    pos.quantity(),
                    entryPrice,
                    exitPrice,
                    currentPrice,
                    realizedPnl,
                    unrealizedPnl,
                    unrealizedPnlPercent,
                    pos.marginUsed(),
                    pos.status() != null ? pos.status().name() : (exitOrder != null ? "CLOSED" : "OPEN"),
                    openTime,
                    closeTime
            ));
        }

        // 4. Any orders with positionId not in positions table (e.g. historical spot or position row cleared)
        for (Map.Entry<Long, List<Order>> entry : ordersByPositionId.entrySet()) {
            Long posId = entry.getKey();
            if (processedPositionIds.contains(posId)) continue;
            processedPositionIds.add(posId);

            List<Order> list = entry.getValue();
            if (list == null || list.isEmpty()) continue;

            Order entryOrder = list.get(0);
            Order exitOrder = list.size() > 1 ? list.get(list.size() - 1) : null;
            if (exitOrder == entryOrder) exitOrder = null;

            boolean isLong = entryOrder.getPositionSide() != null ? entryOrder.getPositionSide() == PositionSide.LONG : entryOrder.getOrderType() == OrderType.BUY;
            boolean isClosed = exitOrder != null || entryOrder.getRealizedPnl() != null;

            BigDecimal entryPrice = entryOrder.getExecutedPrice() != null ? entryOrder.getExecutedPrice() : entryOrder.getPrice();
            BigDecimal exitPrice = isClosed ? (exitOrder != null && exitOrder.getExecutedPrice() != null ? exitOrder.getExecutedPrice() : entryOrder.getExecutedPrice()) : null;
            BigDecimal realizedPnl = isClosed ? (exitOrder != null && exitOrder.getRealizedPnl() != null ? exitOrder.getRealizedPnl() : entryOrder.getRealizedPnl()) : null;

            Stock stock = entryOrder.getStock();
            String sym = stock != null ? stock.getSymbol() : "UNKNOWN";
            String compName = stock != null && stock.getCompanyName() != null ? stock.getCompanyName() : sym;
            String exch = stock != null && stock.getExchange() != null ? stock.getExchange() : "NSE";
            String curr = stock != null && stock.getCurrency() != null ? stock.getCurrency() : "USD";

            trades.add(new ConsolidatedTradeDto(
                    posId,
                    entryOrder.getId(),
                    exitOrder != null ? exitOrder.getId() : null,
                    sym,
                    compName,
                    exch,
                    curr,
                    isLong ? "LONG" : "SHORT",
                    entryOrder.getTradingMode() != null ? entryOrder.getTradingMode().name() : "INTRADAY",
                    entryOrder.getLeverage() != null ? entryOrder.getLeverage() : 1,
                    entryOrder.getQuantity(),
                    entryPrice,
                    exitPrice,
                    exitPrice != null ? exitPrice : entryPrice,
                    realizedPnl,
                    null,
                    null,
                    entryOrder.getMarginUsed() != null ? entryOrder.getMarginUsed() : BigDecimal.ZERO,
                    isClosed ? "CLOSED" : "OPEN",
                    entryOrder.getExecutedAt() != null ? entryOrder.getExecutedAt() : entryOrder.getCreatedAt(),
                    isClosed && exitOrder != null ? (exitOrder.getExecutedAt() != null ? exitOrder.getExecutedAt() : exitOrder.getCreatedAt()) : null
            ));
        }

        // 5. Apply filtering
        List<ConsolidatedTradeDto> filtered = trades.stream()
                .filter(t -> {
                    if (symbol != null && !symbol.trim().isEmpty()) {
                        String s = symbol.trim().toLowerCase();
                        boolean matchSymbol = t.symbol() != null && t.symbol().toLowerCase().contains(s);
                        boolean matchName = t.companyName() != null && t.companyName().toLowerCase().contains(s);
                        if (!matchSymbol && !matchName) return false;
                    }
                    if (status != null && !status.trim().isEmpty() && !"ALL".equalsIgnoreCase(status.trim())) {
                        if (!status.trim().equalsIgnoreCase(t.status())) return false;
                    }
                    if (direction != null && !direction.trim().isEmpty() && !"ALL".equalsIgnoreCase(direction.trim())) {
                        if (!direction.trim().equalsIgnoreCase(t.direction())) return false;
                    }
                    if (tradingMode != null && !tradingMode.trim().isEmpty() && !"ALL".equalsIgnoreCase(tradingMode.trim())) {
                        if (!tradingMode.trim().equalsIgnoreCase(t.tradingMode())) return false;
                    }
                    if (startDate != null) {
                        Instant tTime = t.openTime() != null ? t.openTime() : t.closeTime();
                        if (tTime != null && tTime.isBefore(startDate)) return false;
                    }
                    if (endDate != null) {
                        Instant tTime = t.openTime() != null ? t.openTime() : t.closeTime();
                        if (tTime != null && tTime.isAfter(endDate)) return false;
                    }
                    return true;
                })
                .sorted((a, b) -> {
                    Instant timeA = a.openTime() != null ? a.openTime() : Instant.EPOCH;
                    Instant timeB = b.openTime() != null ? b.openTime() : Instant.EPOCH;
                    if ("asc".equalsIgnoreCase(sortDirection)) {
                        return timeA.compareTo(timeB);
                    } else {
                        return timeB.compareTo(timeA);
                    }
                })
                .toList();

        // 6. Pagination
        int totalElements = filtered.size();
        int pageIndex = Math.max(0, page);
        int pageSize = (size <= 0 || size > 100) ? 15 : size;
        int totalPages = (int) Math.ceil((double) totalElements / pageSize);
        if (totalPages == 0) totalPages = 1;

        int fromIndex = pageIndex * pageSize;
        List<ConsolidatedTradeDto> pageContent;
        if (fromIndex >= totalElements) {
            pageContent = Collections.emptyList();
        } else {
            int toIndex = Math.min(fromIndex + pageSize, totalElements);
            pageContent = filtered.subList(fromIndex, toIndex);
        }

        return new PageResponseDto<>(
                pageContent,
                pageIndex,
                pageSize,
                totalElements,
                totalPages,
                pageIndex == 0,
                pageIndex >= totalPages - 1
        );
    }
}

