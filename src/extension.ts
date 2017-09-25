'use strict';

import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as path from 'path';

import { Commands } from './commands';
import { lspmodule } from './lspmodule';
import { contentprovidermodule } from './contentprovidermodule';
import { stackanalysismodule } from './stackanalysismodule';
import { multimanifestmodule } from './multimanifestmodule';
import { Apiendpoint } from './apiendpoint';
import { authextension } from './authextension';

export function activate(context: vscode.ExtensionContext) {
  
  let disposableLSp = lspmodule.invoke_f8_lsp(context);

	let previewUri = vscode.Uri.parse('fabric8-analytics-widget://authority/fabric8-analytics-widget');

	let provider = new contentprovidermodule.TextDocumentContentProvider();  //new TextDocumentContentProvider();
	let registration = vscode.workspace.registerTextDocumentContentProvider('fabric8-analytics-widget', provider);

  let f8AnalyticsStatusBarItem: vscode.StatusBarItem;
  f8AnalyticsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  f8AnalyticsStatusBarItem.command = Commands.TRIGGER_F8_AUTHORIZE;
  f8AnalyticsStatusBarItem.text = 'Authorize fabric8-analytics';
  f8AnalyticsStatusBarItem.tooltip = 'Authorize fabric8-analytics';
  f8AnalyticsStatusBarItem.show();

	let disposable = vscode.commands.registerCommand(Commands.TRIGGER_STACK_ANALYSIS, () => {
		let editor = vscode.window.activeTextEditor;
    let text = editor.document.getText();

    provider.signalInit(previewUri,null);

    let answer1: string;
    let options = {
      prompt: "Action: Enter openshift.io auth token",
      placeHolder: "Please provide your auth token, can be retrieved from OSIO"
    }

    let lastTagged = context.globalState.get('lastTagged', '');
    if(!lastTagged) {
      vscode.window.showInputBox(options).then(value => {
        if (!value) return;
        Apiendpoint.STACK_API_TOKEN = value;
        process.env['RECOMMENDER_API_TOKEN'] = Apiendpoint.STACK_API_TOKEN;
        context.globalState.update('lastTagged', Apiendpoint.STACK_API_TOKEN);
        return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.One, 'fabric8-analytics stack report').then((success) => {
          stackanalysismodule.get_stack_metadata(context, editor.document.uri, {manifest: text, origin: 'lsp'}, provider, Apiendpoint.STACK_API_TOKEN, (data) => { provider.signal(previewUri, data) });
          provider.signalInit(previewUri,null);
           }, (reason) => {
		 	    vscode.window.showErrorMessage(reason);
        });
      });
  } else {
       Apiendpoint.STACK_API_TOKEN = lastTagged;
       process.env['RECOMMENDER_API_TOKEN'] = lastTagged;
       return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.One, 'fabric8-analytics stack report').then((success) => {
        stackanalysismodule.get_stack_metadata(context, editor.document.uri, {manifest: text, origin: 'lsp'}, provider, Apiendpoint.STACK_API_TOKEN, (data) => { provider.signal(previewUri, data) });
        provider.signalInit(previewUri,null);
      }, (reason) => {
		 	  vscode.window.showErrorMessage(reason);
		  });
    }
	});

  let disposableFullStack = vscode.commands.registerCommand(Commands.TRIGGER_FULL_STACK_ANALYSIS, () => {
    provider.signalInit(previewUri,null);
    let lastTagged = context.globalState.get('lastTagged', '');
    Apiendpoint.STACK_API_TOKEN = lastTagged;
    process.env['RECOMMENDER_API_TOKEN'] = lastTagged;
    return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.One, 'fabric8-analytics stack report').then((success) => {
          multimanifestmodule.find_manifests_workspace(context, provider, Apiendpoint.STACK_API_TOKEN, (data) => { provider.signal(previewUri, data) });
          provider.signalInit(previewUri,null);
           }, (reason) => {
		 	    vscode.window.showErrorMessage(reason);
        });
  });

  let disposableF8Authorize = vscode.commands.registerCommand(Commands.TRIGGER_F8_AUTHORIZE, () => {
    authextension.authorize_f8_analytics((data) => {
      if(data){
        vscode.window.showInformationMessage('Successfully authorized');
      }
    });
  });

  let disposableF8UnAuthorize = vscode.commands.registerCommand(Commands.TRIGGER_F8_UNAUTHORIZE, () => {
    context.globalState.update('lastTagged', '');
    vscode.window.showInformationMessage('You have been unauthorized from fabric8 analytics','Authorize').then((selection) => {
      console.log(selection);
      if(selection == 'Authorize'){
        authextension.authorize_f8_analytics((data) => {
          if(data){
            vscode.window.showInformationMessage('Successfully authorized');
          }
        });
      }

    });
  });

	let highlight = vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(0,0,0,.35)' });
	context.subscriptions.push(disposable, registration, disposableLSp, disposableFullStack, disposableF8Authorize, disposableF8UnAuthorize);
}

