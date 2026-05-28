var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

var app = builder.Build();

app.UseCors();

// Stubs — à remplacer par votre domaine / EF Core
app.MapGet("/api/dashboard", () => new
{
    balance = 1842.79m,
    monthlyIncome = 2450m,
    monthlyExpenses = 703.21m,
    monthlyBudgetLimit = 1500m,
    budgetRemaining = 796.79m,
    budgetProgress = 0.47
});

app.MapGet("/api/transactions", () => Array.Empty<object>());
app.MapGet("/api/budgets", () => Array.Empty<object>());
app.MapGet("/api/categories", () => Array.Empty<object>());
app.MapPost("/api/transactions", (object _) => Results.Accepted());

app.Run();
