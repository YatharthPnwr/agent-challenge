// Test script to verify workflow functionality
// Since we can't directly import TypeScript files, let's test via the Mastra server

async function testWorkflow() {
  try {
    console.log('Testing GitHub Reporter Features via API...\n');
    
    // Test 1: Repository Analysis (should NOT include charts)
    console.log('🧪 Test 1: Repository Analysis (should NOT include charts)');
    const analysisResponse = await fetch('http://localhost:8080/agents/githubReporterAgent/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: 'Analyze https://github.com/facebook/react-native'
        }]
      })
    });
    
    if (analysisResponse.ok) {
      const result = await analysisResponse.json();
      console.log('✅ Analysis API call successful!');
      
      if (result.messages && result.messages.length > 0) {
        const lastMessage = result.messages[result.messages.length - 1];
        const hasBarChart = lastMessage.content.includes('![Repository Statistics Bar Chart]');
        const hasPieChart = lastMessage.content.includes('![Language Distribution Pie Chart]');
        
        console.log('Chart presence check:');
        console.log('Bar chart present:', hasBarChart);
        console.log('Pie chart present:', hasPieChart);
        
        if (!hasBarChart && !hasPieChart) {
          console.log('✅ SUCCESS: Analysis report correctly excludes charts!');
        } else {
          console.log('❌ FAILURE: Analysis report should NOT include charts');
        }
      }
    } else {
      console.log('❌ Analysis API call failed:', analysisResponse.status, analysisResponse.statusText);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Repository Visualization (should include charts)
    console.log('🧪 Test 2: Repository Visualization (should include charts)');
    const visualizationResponse = await fetch('http://localhost:8080/agents/githubReporterAgent/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: 'Visualize https://github.com/facebook/react-native'
        }]
      })
    });
    
    if (visualizationResponse.ok) {
      const result = await visualizationResponse.json();
      console.log('✅ Visualization API call successful!');
      
      if (result.messages && result.messages.length > 0) {
        const lastMessage = result.messages[result.messages.length - 1];
        const hasBarChart = lastMessage.content.includes('![Repository Statistics Bar Chart]') || 
                           lastMessage.content.includes('barChartUrl');
        const hasPieChart = lastMessage.content.includes('![Language Distribution Pie Chart]') || 
                           lastMessage.content.includes('pieChartUrl');
        
        console.log('Chart presence check:');
        console.log('Bar chart present:', hasBarChart);
        console.log('Pie chart present:', hasPieChart);
        
        if (hasBarChart && hasPieChart) {
          console.log('✅ SUCCESS: Visualization report correctly includes both charts!');
        } else {
          console.log('❌ FAILURE: Visualization report should include both charts');
        }
      }
    } else {
      console.log('❌ Visualization API call failed:', visualizationResponse.status, visualizationResponse.statusText);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Good First Issues
    console.log('🧪 Test 3: Good First Issues');
    const issuesResponse = await fetch('http://localhost:8080/agents/githubReporterAgent/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
          content: 'Get good first issues for https://github.com/facebook/react-native'
          }]
        })
      });
      
    if (issuesResponse.ok) {
      const result = await issuesResponse.json();
      console.log('✅ Good First Issues API call successful!');
      
      if (result.messages && result.messages.length > 0) {
        const lastMessage = result.messages[result.messages.length - 1];
        const hasIssues = lastMessage.content.includes('good first issue') || 
                         lastMessage.content.includes('issues') ||
                         lastMessage.content.includes('No open');
        
        console.log('Issues content present:', hasIssues);
        
        if (hasIssues) {
          console.log('✅ SUCCESS: Good First Issues feature working!');
      } else {
          console.log('❌ FAILURE: Good First Issues feature not working properly');
        }
      }
    } else {
      console.log('❌ Good First Issues API call failed:', issuesResponse.status, issuesResponse.statusText);
    }
    
  } catch (error) {
    console.error('Error testing workflow:', error);
  }
}

testWorkflow(); 