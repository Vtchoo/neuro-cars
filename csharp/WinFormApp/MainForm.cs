using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using SmartRace.Core;

namespace SmartRace.WinForms
{
    public partial class MainForm : Form
    {
        private Game game;
        private CancellationTokenSource cancellationTokenSource;
        private bool isTraining = false;

        // UI Controls
        private Button btnLoadGame;
        private Button btnCreateNew;
        private Button btnStartTraining;
        private Button btnStopTraining;
        private Button btnSaveGame;
        private TextBox txtGenerations;
        private TextBox txtMaxTicks;
        private ComboBox cmbCycleMode;
        private Label lblStatus;
        private Label lblCurrentGen;
        private Label lblMaxFitness;
        private Label lblAvgFitness;
        private Label lblTicks;
        private ProgressBar progressBar;
        private RichTextBox txtLog;

        public MainForm()
        {
            InitializeComponent();
            SetupGame();
        }

        private void InitializeComponent()
        {
            this.Text = "Smart Race - Neural Network Training";
            this.Size = new System.Drawing.Size(800, 600);
            this.StartPosition = FormStartPosition.CenterScreen;

            // Create controls
            btnLoadGame = new Button { Text = "Load Game", Location = new System.Drawing.Point(20, 20), Size = new System.Drawing.Size(100, 30) };
            btnCreateNew = new Button { Text = "Create New", Location = new System.Drawing.Point(130, 20), Size = new System.Drawing.Size(100, 30) };
            btnStartTraining = new Button { Text = "Start Training", Location = new System.Drawing.Point(20, 60), Size = new System.Drawing.Size(100, 30) };
            btnStopTraining = new Button { Text = "Stop Training", Location = new System.Drawing.Point(130, 60), Size = new System.Drawing.Size(100, 30), Enabled = false };
            btnSaveGame = new Button { Text = "Save Game", Location = new System.Drawing.Point(240, 60), Size = new System.Drawing.Size(100, 30) };

            // Training parameters
            var lblGen = new Label { Text = "Generations:", Location = new System.Drawing.Point(20, 110), Size = new System.Drawing.Size(80, 20) };
            txtGenerations = new TextBox { Text = "100", Location = new System.Drawing.Point(110, 108), Size = new System.Drawing.Size(60, 20) };
            
            var lblMaxTicks = new Label { Text = "Max Ticks:", Location = new System.Drawing.Point(180, 110), Size = new System.Drawing.Size(70, 20) };
            txtMaxTicks = new TextBox { Text = "1000", Location = new System.Drawing.Point(260, 108), Size = new System.Drawing.Size(60, 20) };

            var lblCycleMode = new Label { Text = "Start Point:", Location = new System.Drawing.Point(330, 110), Size = new System.Drawing.Size(70, 20) };
            cmbCycleMode = new ComboBox 
            { 
                Location = new System.Drawing.Point(410, 108), 
                Size = new System.Drawing.Size(90, 20),
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            cmbCycleMode.Items.AddRange(new[] { "Off", "Sequential", "Random" });
            cmbCycleMode.SelectedIndex = 1; // Default to Sequential

            // Status display
            lblStatus = new Label { Text = "Ready", Location = new System.Drawing.Point(20, 140), Size = new System.Drawing.Size(700, 20), ForeColor = System.Drawing.Color.Blue };
            
            var lblGenLabel = new Label { Text = "Generation:", Location = new System.Drawing.Point(20, 170), Size = new System.Drawing.Size(80, 20) };
            lblCurrentGen = new Label { Text = "0", Location = new System.Drawing.Point(110, 170), Size = new System.Drawing.Size(60, 20), ForeColor = System.Drawing.Color.Green };
            
            var lblMaxFitLabel = new Label { Text = "Max Fitness:", Location = new System.Drawing.Point(180, 170), Size = new System.Drawing.Size(80, 20) };
            lblMaxFitness = new Label { Text = "0.00", Location = new System.Drawing.Point(270, 170), Size = new System.Drawing.Size(80, 20), ForeColor = System.Drawing.Color.Green };
            
            var lblAvgFitLabel = new Label { Text = "Avg Fitness:", Location = new System.Drawing.Point(360, 170), Size = new System.Drawing.Size(80, 20) };
            lblAvgFitness = new Label { Text = "0.00", Location = new System.Drawing.Point(450, 170), Size = new System.Drawing.Size(80, 20), ForeColor = System.Drawing.Color.Green };
            
            var lblTicksLabel = new Label { Text = "Ticks:", Location = new System.Drawing.Point(540, 170), Size = new System.Drawing.Size(50, 20) };
            lblTicks = new Label { Text = "0", Location = new System.Drawing.Point(600, 170), Size = new System.Drawing.Size(60, 20), ForeColor = System.Drawing.Color.Green };

            // Progress bar
            progressBar = new ProgressBar { Location = new System.Drawing.Point(20, 200), Size = new System.Drawing.Size(720, 25) };

            // Log area
            var lblLog = new Label { Text = "Training Log:", Location = new System.Drawing.Point(20, 240), Size = new System.Drawing.Size(100, 20) };
            txtLog = new RichTextBox { 
                Location = new System.Drawing.Point(20, 265), 
                Size = new System.Drawing.Size(720, 280),
                ReadOnly = true,
                Font = new System.Drawing.Font("Consolas", 9)
            };

            // Add event handlers
            btnLoadGame.Click += BtnLoadGame_Click;
            btnCreateNew.Click += BtnCreateNew_Click;
            btnStartTraining.Click += BtnStartTraining_Click;
            btnStopTraining.Click += BtnStopTraining_Click;
            btnSaveGame.Click += BtnSaveGame_Click;
            cmbCycleMode.SelectedIndexChanged += CmbCycleMode_SelectedIndexChanged;

            // Add all controls to the form
            this.Controls.AddRange(new Control[] {
                btnLoadGame, btnCreateNew, btnStartTraining, btnStopTraining, btnSaveGame,
                lblGen, txtGenerations, lblMaxTicks, txtMaxTicks, lblCycleMode, cmbCycleMode,
                lblStatus, lblGenLabel, lblCurrentGen, lblMaxFitLabel, lblMaxFitness, 
                lblAvgFitLabel, lblAvgFitness, lblTicksLabel, lblTicks,
                progressBar, lblLog, txtLog
            });
        }

        private void SetupGame()
        {
            game = new Game();
            
            // Subscribe to events
            game.GenerationCompleted += Game_GenerationCompleted;
            game.TickCompleted += Game_TickCompleted;
            game.StatusUpdated += Game_StatusUpdated;
        }

        private async void BtnLoadGame_Click(object sender, EventArgs e)
        {
            using (var dialog = new OpenFileDialog())
            {
                dialog.Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*";
                dialog.Title = "Load Game Save";

                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    bool success = await game.LoadGameAsync(dialog.FileName);
                    if (success)
                    {
                        UpdateStatsDisplay();
                        LogMessage($"Game loaded successfully from {dialog.FileName}");
                    }
                }
            }
        }

        private void BtnCreateNew_Click(object sender, EventArgs e)
        {
            game.CreateNewGame();
            UpdateStatsDisplay();
            LogMessage("New game created");
        }

        private async void BtnStartTraining_Click(object sender, EventArgs e)
        {
            if (isTraining) return;

            if (!int.TryParse(txtGenerations.Text, out int generations) || generations <= 0)
            {
                MessageBox.Show("Please enter a valid number of generations.");
                return;
            }

            if (!int.TryParse(txtMaxTicks.Text, out int maxTicks) || maxTicks <= 0)
            {
                MessageBox.Show("Please enter a valid maximum ticks value.");
                return;
            }

            isTraining = true;
            cancellationTokenSource = new CancellationTokenSource();

            btnStartTraining.Enabled = false;
            btnStopTraining.Enabled = true;
            progressBar.Maximum = game.Generation + generations;
            progressBar.Value = 0;

            LogMessage($"Starting training for {generations} generations with max {maxTicks} ticks per generation...");

            try
            {
                await game.RunTrainingAsync(generations, maxTicks, cancellationTokenSource.Token);
                LogMessage("Training completed successfully!");
            }
            catch (OperationCanceledException)
            {
                LogMessage("Training was cancelled.");
            }
            catch (Exception ex)
            {
                LogMessage($"Training error: {ex.Message}");
                MessageBox.Show($"Training error: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                isTraining = false;
                btnStartTraining.Enabled = true;
                btnStopTraining.Enabled = false;
            }
        }

        private void BtnStopTraining_Click(object sender, EventArgs e)
        {
            cancellationTokenSource?.Cancel();
            LogMessage("Stop training requested...");
        }

        private async void BtnSaveGame_Click(object sender, EventArgs e)
        {
            using (var dialog = new SaveFileDialog())
            {
                dialog.Filter = "JSON files (*.json)|*.json";
                dialog.Title = "Save Game";
                dialog.FileName = $"smartrace_save_gen{game.GetStats().generation}_{DateTime.Now:yyyyMMdd_HHmmss}.json";

                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    bool success = await game.SaveGameAsync(dialog.FileName);
                    if (success)
                    {
                        LogMessage($"Game saved successfully to {dialog.FileName}");
                    }
                }
            }
        }

        private void CmbCycleMode_SelectedIndexChanged(object sender, EventArgs e)
        {
            if (game != null)
            {
                switch (cmbCycleMode.SelectedIndex)
                {
                    case 0:
                        game.CycleStartPoint = CycleStartPoint.Off;
                        break;
                    case 1:
                        game.CycleStartPoint = CycleStartPoint.Sequential;
                        break;
                    case 2:
                        game.CycleStartPoint = CycleStartPoint.Random;
                        break;
                }
                LogMessage($"Start point cycling set to: {game.CycleStartPoint}");
            }
        }

        private void Game_GenerationCompleted(int generation, double maxFitness, double avgFitness)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<int, double, double>(Game_GenerationCompleted), generation, maxFitness, avgFitness);
                return;
            }

            UpdateStatsDisplay();
            progressBar.Value = generation + 1;
            LogMessage($"Generation {generation} completed - Max: {maxFitness:F2}, Avg: {avgFitness:F2}");
        }

        private void Game_TickCompleted(int ticks)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<int>(Game_TickCompleted), ticks);
                return;
            }

            lblTicks.Text = ticks.ToString();
        }

        private void Game_StatusUpdated(string status)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<string>(Game_StatusUpdated), status);
                return;
            }

            lblStatus.Text = status;
        }

        private void UpdateStatsDisplay()
        {
            var stats = game.GetStats();
            lblCurrentGen.Text = stats.generation.ToString();
            lblMaxFitness.Text = stats.maxFitness.ToString("F2");
            lblAvgFitness.Text = stats.avgFitness.ToString("F2");
            lblTicks.Text = stats.ticks.ToString();
            
            // Update MaxTicks input field with loaded value
            txtMaxTicks.Text = game.MaxTicks.ToString();
            
            // Update cycle mode ComboBox with loaded value
            switch (game.CycleStartPoint)
            {
                case CycleStartPoint.Off:
                    cmbCycleMode.SelectedIndex = 0;
                    break;
                case CycleStartPoint.Sequential:
                    cmbCycleMode.SelectedIndex = 1;
                    break;
                case CycleStartPoint.Random:
                    cmbCycleMode.SelectedIndex = 2;
                    break;
            }
        }

        private void LogMessage(string message)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<string>(LogMessage), message);
                return;
            }

            string timestamp = DateTime.Now.ToString("HH:mm:ss");
            txtLog.AppendText($"[{timestamp}] {message}\n");
            txtLog.ScrollToCaret();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            cancellationTokenSource?.Cancel();
            base.OnFormClosing(e);
        }
    }

    // Program entry point
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}