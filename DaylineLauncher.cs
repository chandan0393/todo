using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace DaylineApp
{
    static class Program
    {
        private static Mutex appMutex = null;
        private static Process serverProcess = null;
        private static NotifyIcon trayIcon = null;
        private const string AppUrl = "http://localhost:3001";
        private const string MutexName = "Global\\Dayline_Desktop_App_Mutex_3001";

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool createdNew = false;
            try
            {
                appMutex = new Mutex(true, MutexName, out createdNew);
            }
            catch
            {
                createdNew = true;
            }

            if (!createdNew)
            {
                // App already running: simply open the window and exit
                LaunchAppWindow();
                return;
            }

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string nodePath = FindNode(baseDir);

            if (string.IsNullOrEmpty(nodePath))
            {
                DialogResult res = MessageBox.Show(
                    "Node.js was not found on your computer.\n\nDayline requires Node.js to run its local offline database and server.\n\nWould you like to open https://nodejs.org to install Node.js?",
                    "Dayline - Node.js Required",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning
                );
                if (res == DialogResult.Yes)
                {
                    Process.Start("https://nodejs.org");
                }
                return;
            }

            // Start backend node server
            try
            {
                StartServer(nodePath, baseDir);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Failed to start Dayline background server:\n\n" + ex.Message,
                    "Dayline Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            // Ensure server is killed when app exits
            AppDomain.CurrentDomain.ProcessExit += OnProcessExit;
            Application.ApplicationExit += OnProcessExit;

            // Wait for server to be responsive
            bool ready = WaitForServer();
            if (!ready)
            {
                MessageBox.Show(
                    "Dayline server could not be started or did not respond in time.\n\nPlease ensure port 3001 is available and run 'npm run build' first.",
                    "Dayline - Startup Warning",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
            }

            // Setup tray icon
            SetupTrayIcon(baseDir);

            // Launch desktop window
            LaunchAppWindow();

            // Run message loop
            Application.Run();
        }

        private static string FindNode(string baseDir)
        {
            // 1. Check local bin\node.exe
            string localBin = Path.Combine(baseDir, "bin\\node.exe");
            if (File.Exists(localBin)) return localBin;

            // 2. Check local node.exe in same folder
            string localNode = Path.Combine(baseDir, "node.exe");
            if (File.Exists(localNode)) return localNode;

            // 3. Check Program Files
            string pfNode = @"C:\Program Files\nodejs\node.exe";
            if (File.Exists(pfNode)) return pfNode;

            // 4. Check Program Files (x86)
            string pfx86Node = @"C:\Program Files (x86)\nodejs\node.exe";
            if (File.Exists(pfx86Node)) return pfx86Node;

            // 5. Check PATH
            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            string[] dirs = pathEnv.Split(';');
            foreach (string d in dirs)
            {
                try
                {
                    string candidate = Path.Combine(d.Trim(), "node.exe");
                    if (File.Exists(candidate)) return candidate;
                }
                catch { }
            }

            return null;
        }

        private static bool IsServerHealthy()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(AppUrl);
                req.Timeout = 800;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    if (resp.StatusCode == HttpStatusCode.OK)
                    {
                        using (StreamReader reader = new StreamReader(resp.GetResponseStream()))
                        {
                            string html = reader.ReadToEnd();
                            // Check that it returned the actual frontend HTML and not an Express 404
                            if (html.IndexOf("Dayline", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                html.IndexOf("root", StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                return true;
                            }
                        }
                    }
                }
            }
            catch { }
            return false;
        }

        private static void KillStaleProcessOnPort(int port)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = string.Format("/c for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :{0} ^| findstr LISTENING') do taskkill /f /pid %a", port);
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process p = Process.Start(psi);
                if (p != null) p.WaitForExit(1500);
            }
            catch { }
        }

        private static void StartServer(string nodePath, string baseDir)
        {
            // If already healthy, no need to spawn another server
            if (IsServerHealthy()) return;

            // Terminate any zombie process holding port 3001 that is not healthy
            KillStaleProcessOnPort(3001);
            Thread.Sleep(400);

            string serverScript = Path.Combine(baseDir, "server\\index.js");
            if (!File.Exists(serverScript))
            {
                throw new FileNotFoundException("Server entry point not found at: " + serverScript);
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = nodePath;
            psi.Arguments = "\"" + serverScript + "\"";
            psi.WorkingDirectory = baseDir;
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.EnvironmentVariables["NODE_ENV"] = "production";
            psi.EnvironmentVariables["PORT"] = "3001";

            serverProcess = Process.Start(psi);
        }

        private static bool WaitForServer()
        {
            for (int i = 0; i < 40; i++)
            {
                if (IsServerHealthy()) return true;
                if (serverProcess != null && serverProcess.HasExited)
                {
                    return false;
                }
                Thread.Sleep(250);
            }
            return IsServerHealthy();
        }

        public static void LaunchAppWindow()
        {
            // Try Edge App Mode (Standalone window, zero browser chrome)
            string edge = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            if (!File.Exists(edge))
            {
                edge = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
            }

            if (File.Exists(edge))
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = edge;
                psi.Arguments = "--app=" + AppUrl + " --window-size=1200,820";
                Process.Start(psi);
                return;
            }

            // Try Chrome App Mode
            string chrome = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
            if (!File.Exists(chrome))
            {
                chrome = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";
            }
            if (!File.Exists(chrome))
            {
                string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                chrome = Path.Combine(localApp, @"Google\Chrome\Application\chrome.exe");
            }

            if (File.Exists(chrome))
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = chrome;
                psi.Arguments = "--app=" + AppUrl + " --window-size=1200,820";
                Process.Start(psi);
                return;
            }

            // Fallback to default browser
            Process.Start(AppUrl);
        }

        private static void SetupTrayIcon(string baseDir)
        {
            trayIcon = new NotifyIcon();
            trayIcon.Text = "Dayline - Personal Tasks & Workspace";

            string icoPath = Path.Combine(baseDir, "app.ico");
            if (File.Exists(icoPath))
            {
                try
                {
                    trayIcon.Icon = new Icon(icoPath);
                }
                catch
                {
                    trayIcon.Icon = SystemIcons.Application;
                }
            }
            else
            {
                trayIcon.Icon = SystemIcons.Application;
            }

            ContextMenu menu = new ContextMenu();

            MenuItem openItem = new MenuItem("Open Dayline", delegate { LaunchAppWindow(); });
            openItem.DefaultItem = true; // Bold font
            menu.MenuItems.Add(openItem);

            menu.MenuItems.Add(new MenuItem("Open in Browser", delegate { Process.Start(AppUrl); }));
            menu.MenuItems.Add("-");

            MenuItem statusItem = new MenuItem("Status: Running on port 3001");
            statusItem.Enabled = false;
            menu.MenuItems.Add(statusItem);

            menu.MenuItems.Add("-");
            menu.MenuItems.Add(new MenuItem("Exit Dayline", delegate { ExitApplication(); }));

            trayIcon.ContextMenu = menu;
            trayIcon.DoubleClick += delegate { LaunchAppWindow(); };
            trayIcon.Visible = true;
        }

        private static void ExitApplication()
        {
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
                trayIcon = null;
            }
            KillServer();
            Application.Exit();
        }

        private static void OnProcessExit(object sender, EventArgs e)
        {
            KillServer();
        }

        private static void KillServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess = null;
                }
            }
            catch { }
        }
    }
}
