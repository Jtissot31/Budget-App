namespace BudgetTracker.Mobile;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();
        Routing.RegisterRoute("add-transaction", typeof(Views.Pages.AddTransactionPage));

        var addItem = new ToolbarItem
        {
            Text = "+",
            Order = ToolbarItemOrder.Primary,
            Priority = 0
        };
        addItem.Clicked += async (_, _) => await GoToAsync("add-transaction");
        ToolbarItems.Add(addItem);
    }
}
