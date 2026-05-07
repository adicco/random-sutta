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
