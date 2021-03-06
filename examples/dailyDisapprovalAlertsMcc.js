import { checkExtensionType, formatExtensionHtml } from './extensions/shared';
import { HtmlTable, tableStyle } from './shared/email';
import { isNull, isUndefined, isEmpty } from './shared/utils';

const emailAddresses = {
  // 'label': 'email@example.com'
  'Jonathan': 'jfaircloth@cocg.co',
};
let sendEmail = false;

const checkAds = function(){
  let localSendEmail = false;
  
  let table = new HtmlTable({
    title: AdWordsApp.currentAccount().getName() + ' - Ads Not Approved',
    columns: ['Campaign', 'Ad Group', 'Status', 'Reasons'],
    style: tableStyle
  });
  
  let report = AdWordsApp.report('SELECT AccountDescriptiveName, CampaignName, AdGroupName, CreativeApprovalStatus, AdGroupAdDisapprovalReasons ' +
      'FROM AD_PERFORMANCE_REPORT ' +
      'WHERE CampaignStatus = ENABLED and AdGroupStatus = ENABLED and Status = ENABLED and CreativeApprovalStatus NOT_IN [APPROVED, FAMILY_SAFE] ' +
      'DURING LAST_MONTH')
      .rows();
  
  while(report.hasNext()){
    let row = report.next();
    let reasons = row.AdGroupAdDisapprovalReasons;
    let formattedReasons = isEmpty(reasons) || isNull(reasons) || isUndefined(reasons) ? ['Not Found'] : JSON.parse(reasons);
    
    if ( row.ValidationDetails !== 'Approved' ) {
      sendEmail = true;
      localSendEmail = true;
      table.addRow([row.CampaignName, row.AdGroupName, row.CreativeApprovalStatus, formattedReasons.join('<br>')]);
      
    }
  }
  
  table.close();
  
  return localSendEmail === true ?  table.html : '';
};

const checkAdExtensions = function(){
  let localSendEmail = false;
  
  let table = new HtmlTable({
    title: AdWordsApp.currentAccount().getName() + ' - Disapproved Ad Extensions',
    columns: ['Type', 'Status', 'Extension'],
    style: tableStyle
  });
  
  let report = AdWordsApp.report('SELECT AccountDescriptiveName, PlaceholderType, AttributeValues, ValidationDetails, DisapprovalShortNames, FeedItemId ' +
      'FROM PLACEHOLDER_FEED_ITEM_REPORT ' +
      'DURING LAST_30_DAYS')
      .rows();
  
  while(report.hasNext()){
    let row = report.next(),
      type = checkExtensionType(row.PlaceholderType);
    
    if ( row.ValidationDetails !== 'Approved' && row.ValidationDetails !== 'Eligible' ) {
      sendEmail = true;
      localSendEmail = true;
      table.addRow([type, row.ValidationDetails, formatExtensionHtml(row.PlaceholderType, row.AttributeValues)]);
      
      if(type === 'Call'){
        let phoneNumberSelector = AdWordsApp.extensions()
                                            .phoneNumbers()
                                            .withIds([row.FeedItemId])
                                            .get();
        while(phoneNumberSelector.hasNext()){
          let number = phoneNumberSelector.next();
          let current = number.getPhoneNumber();
          
          try {
            number.setPhoneNumber('(555) 555 - 5555');
            number.setPhoneNumber(current);
          } catch(e){
            Logger.log(e);
            table.addRow([e]);
          }
        }
      }
    }
  }
  
  table.close();
  
  return localSendEmail === true ?  table.html : '';
};

const checkKeywords = function(){
  let localSendEmail = false;
  
  let table = new HtmlTable({
    title: AdWordsApp.currentAccount().getName() + ' - Disapproved Keywords',
    columns: ['Campaign', 'Ad Group', 'Match Type', 'Status'],
    style: tableStyle
  });
  
  let report = AdWordsApp.report('SELECT AccountDescriptiveName, CampaignName, AdGroupName, ApprovalStatus, KeywordMatchType ' +
      'FROM KEYWORDS_PERFORMANCE_REPORT ' +
      'WHERE CampaignStatus = ENABLED and AdGroupStatus = ENABLED and Status = ENABLED and ApprovalStatus != APPROVED and CampaignName DOES_NOT_CONTAIN_IGNORE_CASE "display" ')
      .rows();
  
  while(report.hasNext()){
    let row = report.next();
    
    if ( row.ApprovalStatus !== '--' ) {
      sendEmail = true;
      localSendEmail = true;
      table.addRow([row.CampaignName, row.AdGroupName, row.KeywordMatchType, row.ApprovalStatus]);
    }
  }
  
  table.close();
  
  return localSendEmail === true ?  table.html : '';
};

const main = function () {
  for ( let label in emailAddresses ) {
    let emailBody = '';
    let accountIterator = MccApp.accounts()
      .withCondition(`LabelNames CONTAINS_IGNORE_CASE "${label}"`)
      .orderBy('Name')
      .get();
    
    sendEmail = false;
    
    while (accountIterator.hasNext()) {
      let account = accountIterator.next();
      MccApp.select(account);
      
      emailBody += checkAds();
      emailBody += checkAdExtensions();
      emailBody += checkKeywords();
    }
    
    if (sendEmail === true){
      MailApp.sendEmail({
        to: emailAddresses[label],
        subject: 'Daily Account Alerts',
        htmlBody: emailBody,
      });
    }
  }
};

main();