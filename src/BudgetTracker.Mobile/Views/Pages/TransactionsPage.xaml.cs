using BudgetTracker.Mobile.ViewModels;

namespace BudgetTracker.Mobile.Views.Pages;

public partial class TransactionsPage : ContentPage
{
    public TransactionsPage(TransactionsViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        if (BindingContext is TransactionsViewModel vm)
            _ = vm.LoadCommand.ExecuteAsync(null);
    }
}
