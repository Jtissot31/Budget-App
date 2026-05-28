using BudgetTracker.Mobile.ViewModels;

namespace BudgetTracker.Mobile.Views.Pages;

public partial class BudgetsPage : ContentPage
{
    public BudgetsPage(BudgetsViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        if (BindingContext is BudgetsViewModel vm)
            _ = vm.LoadCommand.ExecuteAsync(null);
    }
}
