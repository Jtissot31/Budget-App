using BudgetTracker.Mobile.Models;
using BudgetTracker.Mobile.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace BudgetTracker.Mobile.ViewModels;

public partial class BudgetsViewModel(IBudgetService budgetService) : ObservableObject
{
    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private List<CategoryBudget> _budgets = [];

    [RelayCommand]
    public async Task LoadAsync()
    {
        if (IsBusy)
            return;

        try
        {
            IsBusy = true;
            Budgets = (await budgetService.GetCategoryBudgetsAsync()).ToList();
        }
        finally
        {
            IsBusy = false;
        }
    }
}
