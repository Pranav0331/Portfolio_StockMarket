package com.portfolio.repository;

import com.portfolio.entity.*;
import com.portfolio.entity.enums.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
class DatabaseLayerTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private HoldingRepository holdingRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private WatchlistRepository watchlistRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Test
    @DisplayName("Verify database starts completely empty with zero seed records")
    void verifyDatabaseStartsEmpty() {
        assertThat(userRepository.count()).isEqualTo(0);
        assertThat(stockRepository.count()).isEqualTo(0);
        assertThat(holdingRepository.count()).isEqualTo(0);
        assertThat(orderRepository.count()).isEqualTo(0);
        assertThat(transactionRepository.count()).isEqualTo(0);
        assertThat(watchlistRepository.count()).isEqualTo(0);
        assertThat(alertRepository.count()).isEqualTo(0);
    }

    @Test
    @DisplayName("User entity persists with unique email constraint")
    void testUserUniqueEmail() {
        User user1 = new User("investor@example.com", "Investor One");
        userRepository.saveAndFlush(user1);

        assertThat(user1.getId()).isNotNull();
        assertThat(user1.getCreatedAt()).isNotNull();
        assertThat(user1.getUpdatedAt()).isNotNull();

        User user2 = new User("investor@example.com", "Investor Two");
        assertThatThrownBy(() -> userRepository.saveAndFlush(user2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Stock entity persists with unique symbol and decimal precision")
    void testStockEntity() {
        Stock stock1 = new Stock("AAPL", "Apple Inc.", "NASDAQ", "USD");
        stock1.setCurrentPrice(new BigDecimal("225.5000"));
        stock1.setPreviousClose(new BigDecimal("220.0000"));
        stockRepository.saveAndFlush(stock1);

        Optional<Stock> found = stockRepository.findBySymbol("AAPL");
        assertThat(found).isPresent();
        assertThat(found.get().getCurrentPrice()).isEqualByComparingTo("225.5000");

        Stock stock2 = new Stock("AAPL", "Duplicate Apple", "NASDAQ", "USD");
        assertThatThrownBy(() -> stockRepository.saveAndFlush(stock2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Holding entity persists with foreign keys and unique user-stock constraint")
    void testHoldingEntityAndConstraint() {
        User user = userRepository.saveAndFlush(new User("holder@example.com", "Holder User"));
        Stock stock = stockRepository.saveAndFlush(new Stock("MSFT", "Microsoft Corp.", "NASDAQ", "USD"));

        Holding holding1 = new Holding(user, stock, new BigDecimal("10.0000"), new BigDecimal("410.2500"), new BigDecimal("4102.5000"));
        holdingRepository.saveAndFlush(holding1);

        assertThat(holdingRepository.findByUserId(user.getId())).hasSize(1);

        Holding duplicateHolding = new Holding(user, stock, new BigDecimal("5.0000"), new BigDecimal("400.0000"), new BigDecimal("2000.0000"));
        assertThatThrownBy(() -> holdingRepository.saveAndFlush(duplicateHolding))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Order entity persists with Enum types and user/stock relationships")
    void testOrderEntity() {
        User user = userRepository.saveAndFlush(new User("trader@example.com", "Trader User"));
        Stock stock = stockRepository.saveAndFlush(new Stock("GOOGL", "Alphabet Inc.", "NASDAQ", "USD"));

        Order order = new Order(user, stock, OrderType.BUY, new BigDecimal("15.0000"), new BigDecimal("175.5000"));
        order.setOrderStatus(OrderStatus.PENDING);
        orderRepository.saveAndFlush(order);

        assertThat(order.getId()).isNotNull();
        assertThat(order.getOrderType()).isEqualTo(OrderType.BUY);
        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(orderRepository.findByUserIdAndOrderStatus(user.getId(), OrderStatus.PENDING)).hasSize(1);
    }

    @Test
    @DisplayName("Transaction entity persists with decimal amounts and enum types")
    void testTransactionEntity() {
        User user = userRepository.saveAndFlush(new User("txuser@example.com", "Tx User"));
        Stock stock = stockRepository.saveAndFlush(new Stock("NVDA", "NVIDIA Corp.", "NASDAQ", "USD"));

        Transaction tx = new Transaction(user, stock, TransactionType.BUY, new BigDecimal("2500.0000"));
        tx.setQuantity(new BigDecimal("20.0000"));
        tx.setPricePerUnit(new BigDecimal("125.0000"));
        tx.setFees(new BigDecimal("1.5000"));
        tx.setStatus(TransactionStatus.SUCCESS);
        transactionRepository.saveAndFlush(tx);

        assertThat(tx.getId()).isNotNull();
        assertThat(transactionRepository.findByUserId(user.getId())).hasSize(1);
    }

    @Test
    @DisplayName("Watchlist entity prevents duplicate user-stock entries")
    void testWatchlistDuplicatePrevention() {
        User user = userRepository.saveAndFlush(new User("watcher@example.com", "Watcher User"));
        Stock stock = stockRepository.saveAndFlush(new Stock("AMZN", "Amazon.com Inc.", "NASDAQ", "USD"));

        Watchlist item1 = new Watchlist(user, stock, "Watching earnings");
        watchlistRepository.saveAndFlush(item1);

        assertThat(watchlistRepository.existsByUserIdAndStockId(user.getId(), stock.getId())).isTrue();

        Watchlist item2 = new Watchlist(user, stock, "Duplicate entry");
        assertThatThrownBy(() -> watchlistRepository.saveAndFlush(item2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Alert entity persists with condition types and target price")
    void testAlertEntity() {
        User user = userRepository.saveAndFlush(new User("alerter@example.com", "Alert User"));
        Stock stock = stockRepository.saveAndFlush(new Stock("TSLA", "Tesla Inc.", "NASDAQ", "USD"));

        Alert alert = new Alert(user, stock, new BigDecimal("250.0000"), AlertCondition.GREATER_THAN_OR_EQUAL);
        alert.setStatus(AlertStatus.ACTIVE);
        alertRepository.saveAndFlush(alert);

        assertThat(alert.getId()).isNotNull();
        assertThat(alertRepository.findByStockIdAndStatus(stock.getId(), AlertStatus.ACTIVE)).hasSize(1);
    }
}
