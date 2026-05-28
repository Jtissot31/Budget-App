using BudgetTracker.Mobile.Models;
using BudgetTracker.Mobile.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace BudgetTracker.Mobile.ViewModels;

public partial class DashboardViewModel(IBudgetService budgetService) : ObservableObject
{
    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private decimal _balance;

    [ObservableProperty]
    private decimal _monthlyExpenses;

    [ObservableProperty]
    private decimal _monthlyIncome;

    [ObservableProperty]
    private decimal _monthlyBudgetLimit;

    [ObservableProperty]
    private decimal _budgetRemaining;

    [ObservableProperty]
    private double _budgetProgress;

    [ObservableProperty]
    private List<Transaction> _recentTransactions = [];

    [ObservableProperty]
    private List<CategoryBudget> _topBudgets = [];

    public string BudgetProgressPercent => $"{BudgetProgress * 100:0}%";
    public string BalanceFormatted => $"{Balance:N2} €";
    public string ExpensesFormatted => $"{MonthlyExpenses:N2} €";
    public string IncomeFormatted => $"{MonthlyIncome:N2} €";
    public string RemainingFormatted => $"{BudgetRemaining:N2} € restants";

    [RelayCommand]
    public async Task LoadAsync()
    {
        if (IsBusy)
            return;

        try
        {
            IsBusy = true;
            var summary = await budgetService.GetDashboardAsync();
            Balance = summary.Balance;
            MonthlyExpenses = summary.MonthlyExpenses;
            MonthlyIncome = summary.MonthlyIncome;
            MonthlyBudgetLimit = summary.MonthlyBudgetLimit;
            BudgetRemaining = summary.BudgetRemaining;
            BudgetProgress = summary.BudgetProgress;
            RecentTransactions = summary.RecentTransactions.ToList();
            TopBudgets = summary.TopBudgets.ToList();
            OnPropertyChanged(nameof(BalanceFormatted));
            OnPropertyChanged(nameof(ExpensesFormatted));
            OnPropertyChanged(nameof(IncomeFormatted));
            OnPropertyChanged(nameof(RemainingFormatted));
            OnPropertyChanged(nameof(BudgetProgressPercent));
        }
        finally
        {
            IsBusy = false;
        }
    }
}
