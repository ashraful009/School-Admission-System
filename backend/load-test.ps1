param(
    [Parameter(Mandatory = $true)]
    [string]$ClassId,

    [int]$Requests = 200,

    [string]$BaseUrl = "http://localhost:8080",

    [switch]$SameStudent,

    [string]$StudentId = "30000000000000001"
)

Add-Type -AssemblyName System.Net.Http

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting Load Test against $BaseUrl" -ForegroundColor Cyan
Write-Host "Class ID:    $ClassId" -ForegroundColor Cyan
Write-Host "Requests:    $Requests" -ForegroundColor Cyan
Write-Host "Mode:        $(if ($SameStudent) { 'Same student (' + $StudentId + ')' } else { 'Different students' })" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$handler = [System.Net.Http.HttpClientHandler]::new()
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(60)

$url = "$BaseUrl/classes/$ClassId/holds"

$baseId = [long]10000000000000000
$tasks = [System.Collections.Generic.List[System.Threading.Tasks.Task[System.Net.Http.HttpResponseMessage]]]::new()

$sw = [System.Diagnostics.Stopwatch]::StartNew()

for ($i = 0; $i -lt $Requests; $i++) {
    $currentStudentId = if ($SameStudent) {
        $StudentId
    } else {
        ($baseId + $i + 1).ToString("D17")
    }

    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $url)
    $req.Headers.Add("X-Student-Id", $currentStudentId)
    $tasks.Add($client.SendAsync($req))
}

[System.Threading.Tasks.Task]::WaitAll($tasks.ToArray())
$sw.Stop()

Write-Host "All $Requests requests completed in $($sw.ElapsedMilliseconds) ms." -ForegroundColor Green
Write-Host ""

$results = [System.Collections.Generic.List[PSObject]]::new()

foreach ($t in $tasks) {
    $resp = $t.Result
    $statusCode = [int]$resp.StatusCode
    $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    
    $detail = ""
    if ($body -match '"code"\s*:\s*"([^"]+)"') {
        $detail = $matches[1]
    } elseif ($statusCode -eq 201) {
        $detail = "CREATED"
    }

    $results.Add([PSCustomObject]@{
        StatusCode = $statusCode
        Detail     = $detail
    })
}

Write-Host "Status Code & Detail Tally:" -ForegroundColor Yellow
$results | Group-Object StatusCode, Detail | Select-Object Count, Name | Format-Table -AutoSize

