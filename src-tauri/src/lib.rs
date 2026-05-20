#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(target_os = "macos")]
      {
        use tauri::Manager;

        // Register URL scheme for macOS by forcing Launch Services to index the app bundle
        if let Ok(exe_path) = std::env::current_exe() {
          if let Some(bundle_path) = exe_path.parent().and_then(|p| p.parent()).and_then(|p| p.parent()) {
            if bundle_path.extension().and_then(|s| s.to_str()) == Some("app") {
              let path = bundle_path.to_string_lossy();
              // We only force registration if it's in the Applications folder to avoid dev noise
              if path.contains("/Applications/") {
                let _ = std::process::Command::new("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister")
                  .args(["-f", &path])
                  .spawn();
              }
            }
          }
        }

        // Attempt to find the main window and enable native gestures
        for window in app.webview_windows().values() {
          let _ = window.with_webview(|webview| {
            #[cfg(target_os = "macos")]
            unsafe {
              let wk_webview = webview.inner() as *mut objc2::runtime::AnyObject;
              let _: () = objc2::msg_send![wk_webview, setAllowsBackForwardNavigationGestures: true];
            }
          });
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
