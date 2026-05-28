using BudgetTracker.Mobile.Models;
using BudgetTracker.Mobile.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace BudgetTracker.Mobile.ViewModels;

public partial class TransactionsViewModel(IBudgetService budgetService) : ObservableObject
{
    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private string _searchText = string.Empty;

    [ObservableProperty]
    private List<Transaction> _transactions = [];

    partial void OnSearchTextChanged(string value) => _ = LoadAsync();

    [RelayCommand]
    public async Task LoadAsync()
    {
        if (IsBusy)
            return;

        try
        {
            IsBusy = true;
            Transactions = (await budgetService.GetTransactionsAsync(
                string.IsNullOrWhiteSpace(SearchText) ? null : SearchText)).ToList();
        }
        finally
        {
            IsBusy = false;
        }
    }
}
