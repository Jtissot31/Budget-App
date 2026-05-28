using BudgetTracker.Mobile.ViewModels;

namespace BudgetTracker.Mobile.Views.Pages;

public partial class AddTransactionPage : ContentPage
{
    private readonly AddTransactionViewModel _viewModel;

    public AddTransactionPage(AddTransactionViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _ = _viewModel.InitializeCommand.ExecuteAsync(null);
    }
}
