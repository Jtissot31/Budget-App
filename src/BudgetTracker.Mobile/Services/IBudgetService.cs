using BudgetTracker.Mobile.Models;

namespace BudgetTracker.Mobile.Services;

public interface IBudgetService
{
    Task<DashboardSummary> GetDashboardAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Transaction>> GetTransactionsAsync(
        string? search = null,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CategoryBudget>> GetCategoryBudgetsAsync(
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Category>> GetCategoriesAsync(CancellationToken cancellationToken = default);
    Task<Transaction> AddTransactionAsync(
        Transaction draft,
        CancellationToken cancellationToken = default);
    string ApiBaseUrl { get; set; }
}
