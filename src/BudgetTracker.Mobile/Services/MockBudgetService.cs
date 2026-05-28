using BudgetTracker.Mobile.Models;

namespace BudgetTracker.Mobile.Services;

public sealed class MockBudgetService : IBudgetService
{
    private readonly List<Transaction> _transactions;
    private readonly List<CategoryBudget> _budgets;

    public string ApiBaseUrl { get; set; } = "https://localhost:7080";

    public MockBudgetService()
    {
        var categories = CreateCategories();
        _transactions =
        [
            new Transaction
            {
                Id = Guid.NewGuid(),
                Label = "Courses Carrefour",
                Amount = 87.42m,
                Type = TransactionType.Expense,
                Date = DateTime.Today.AddDays(-1),
                Category = categories[0]
            },
            new Transaction
            {
                Id = Guid.NewGuid(),
                Label = "Salaire",
                Amount = 2450m,
                Type = TransactionType.Income,
                Date = DateTime.Today.AddDays(-3),
                Category = categories[5]
            },
            new Transaction
            {
                Id = Guid.NewGuid(),
                Label = "Netflix",
                Amount = 15.99m,
                Type = TransactionType.Expense,
                Date = DateTime.Today.AddDays(-5),
                Category = categories[3]
            },
            new Transaction
            {
                Id = Guid.NewGuid(),
                Label = "Essence",
                Amount = 62.30m,
                Type = TransactionType.Expense,
                Date = DateTime.Today.AddDays(-6),
                Category = categories[2]
            },
            new Transaction
            {
                Id = Guid.NewGuid(),
                Label = "Restaurant",
                Amount = 48.50m,
                Type = TransactionType.Expense,
                Date = DateTime.Today.AddDays(-8),
                Category = categories[1]
            }
        ];

        _budgets =
        [
            new CategoryBudget { Category = categories[0], Limit = 400, Spent = 287.42m },
            new CategoryBudget { Category = categories[1], Limit = 200, Spent = 148.50m },
            new CategoryBudget { Category = categories[2], Limit = 150, Spent = 112.30m },
            new CategoryBudget { Category = categories[3], Limit = 80, Spent = 65.99m },
            new CategoryBudget { Category = categories[4], Limit = 300, Spent = 89m }
        ];
    }

    public Task<DashboardSummary> GetDashboardAsync(CancellationToken cancellationToken = default)
    {
        var monthStart = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
        var monthTx = _transactions.Where(t => t.Date >= monthStart).ToList();
        var income = monthTx.Where(t => t.Type == TransactionType.Income).Sum(t => t.Amount);
        var expenses = monthTx.Where(t => t.Type == TransactionType.Expense).Sum(t => t.Amount);

        var summary = new DashboardSummary
        {
            Balance = 1842.79m,
            MonthlyIncome = income,
            MonthlyExpenses = expenses,
            MonthlyBudgetLimit = 1500m,
            RecentTransactions = _transactions.OrderByDescending(t => t.Date).Take(5).ToList(),
            TopBudgets = _budgets.OrderByDescending(b => b.Progress).Take(3).ToList()
        };

        return Task.FromResult(summary);
    }

    public Task<IReadOnlyList<Transaction>> GetTransactionsAsync(
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        var query = _transactions.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(t =>
                t.Label.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                t.Category.Name.Contains(search, StringComparison.OrdinalIgnoreCase));
        }

        return Task.FromResult<IReadOnlyList<Transaction>>(
            query.OrderByDescending(t => t.Date).ToList());
    }

    public Task<IReadOnlyList<CategoryBudget>> GetCategoryBudgetsAsync(
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<CategoryBudget>>(_budgets);

    public Task<IReadOnlyList<Category>> GetCategoriesAsync(
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Category>>(CreateCategories());

    public Task<Transaction> AddTransactionAsync(
        Transaction draft,
        CancellationToken cancellationToken = default)
    {
        var created = new Transaction
        {
            Id = Guid.NewGuid(),
            Label = draft.Label,
            Amount = draft.Amount,
            Type = draft.Type,
            Date = draft.Date,
            Category = draft.Category,
            Note = draft.Note
        };
        _transactions.Insert(0, created);
        return Task.FromResult(created);
    }

    private static List<Category> CreateCategories() =>
    [
        new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111101"), Name = "Alimentation", Icon = "🛒", ColorHex = "#22C55E" },
        new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111102"), Name = "Restaurants", Icon = "🍽️", ColorHex = "#F97316" },
        new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111103"), Name = "Transport", Icon = "🚗", ColorHex = "#3B82F6" },
        new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111104"), Name = "Loisirs", Icon = "🎬", ColorHex = "#A855F7" },
        new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111105"), Name = "Logement", Icon = "🏠", ColorHex = "#EAB308" },
        new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111106"), Name = "Revenus", Icon = "💰", ColorHex = "#0D9488" }
    ];
}
