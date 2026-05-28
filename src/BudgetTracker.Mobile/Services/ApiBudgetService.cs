using System.Net.Http.Json;
using BudgetTracker.Mobile.Models;

namespace BudgetTracker.Mobile.Services;

/// <summary>
/// Client HTTP pour l'API .NET 10 — à activer quand les endpoints seront prêts.
/// </summary>
public sealed class ApiBudgetService(HttpClient httpClient) : IBudgetService
{
    private readonly MockBudgetService _fallback = new();

    public string ApiBaseUrl
    {
        get => httpClient.BaseAddress?.ToString().TrimEnd('/') ?? string.Empty;
        set => httpClient.BaseAddress = new Uri(value.TrimEnd('/') + "/");
    }

    public async Task<DashboardSummary> GetDashboardAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return await httpClient.GetFromJsonAsync<DashboardSummary>("api/dashboard", cancellationToken)
                   ?? await _fallback.GetDashboardAsync(cancellationToken);
        }
        catch
        {
            return await _fallback.GetDashboardAsync(cancellationToken);
        }
    }

    public async Task<IReadOnlyList<Transaction>> GetTransactionsAsync(
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var url = string.IsNullOrWhiteSpace(search)
                ? "api/transactions"
                : $"api/transactions?search={Uri.EscapeDataString(search)}";
            return await httpClient.GetFromJsonAsync<List<Transaction>>(url, cancellationToken)
                   ?? await _fallback.GetTransactionsAsync(search, cancellationToken);
        }
        catch
        {
            return await _fallback.GetTransactionsAsync(search, cancellationToken);
        }
    }

    public async Task<IReadOnlyList<CategoryBudget>> GetCategoryBudgetsAsync(
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await httpClient.GetFromJsonAsync<List<CategoryBudget>>("api/budgets", cancellationToken)
                   ?? await _fallback.GetCategoryBudgetsAsync(cancellationToken);
        }
        catch
        {
            return await _fallback.GetCategoryBudgetsAsync(cancellationToken);
        }
    }

    public async Task<IReadOnlyList<Category>> GetCategoriesAsync(
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await httpClient.GetFromJsonAsync<List<Category>>("api/categories", cancellationToken)
                   ?? await _fallback.GetCategoriesAsync(cancellationToken);
        }
        catch
        {
            return await _fallback.GetCategoriesAsync(cancellationToken);
        }
    }

    public async Task<Transaction> AddTransactionAsync(
        Transaction draft,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync("api/transactions", draft, cancellationToken);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<Transaction>(cancellationToken)
                   ?? await _fallback.AddTransactionAsync(draft, cancellationToken);
        }
        catch
        {
            return await _fallback.AddTransactionAsync(draft, cancellationToken);
        }
    }
}
